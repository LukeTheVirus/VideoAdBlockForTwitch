//This stops Twitch from pausing the player when in another tab and an ad shows.
try {
    Object.defineProperty(document, 'visibilityState', {
        get() {
            return 'visible';
        }
    });
    Object.defineProperty(document, 'hidden', {
        get() {
            return false;
        }
    });
    const block = e => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    };
    const process = e => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        //This corrects the background tab buffer bug when switching to the background tab for the first time after an extended period.
        doTwitchPlayerTask(false, false, true, false, false);
    };
    document.addEventListener('visibilitychange', process, true);
    document.addEventListener('webkitvisibilitychange', block, true);
    document.addEventListener('mozvisibilitychange', block, true);
    document.addEventListener('hasFocus', block, true);
    if (/Firefox/.test(navigator.userAgent)) {
        Object.defineProperty(document, 'mozHidden', {
            get() {
                return false;
            }
        });
    } else {
        Object.defineProperty(document, 'webkitHidden', {
            get() {
                return false;
            }
        });
    }
} catch (err) {}

//Send settings updates to worker.
window.addEventListener('message', (event) => {
    if (event.source != window) {
        return;
    }
    if (event.data?.type === 'SetTwitchAdblockSettings' && event.data.settings) {
        TwitchAdblockSettings = event.data.settings;
    }
}, false);

function declareOptions(scope) {
    scope.AdSignifier = 'stitched';
    scope.ClientID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
    scope.ClientVersion = 'null';
    scope.ClientSession = 'null';
    //scope.PlayerType1 = 'site'; //Source - NOTE: This is unused as it's implicitly used by the website iself
    scope.PLAYER_TYPE_EMBED = 'embed'; //Source
    scope.PLAYER_TYPE_PROXY = 'proxy'; //Source
    scope.PLAYER_TYPE_AUTOPLAY = 'autoplay'; //360p
    scope.CurrentChannelName = null;
    scope.UsherParams = null;
    scope.WasShowingAd = false;
    scope.GQLDeviceID = null;
    scope.IsSquadStream = false;
    scope.StreamInfos = [];
    scope.StreamInfosByUrl = [];
    scope.MainUrlByUrl = [];
    scope.EncodingCacheTimeout = 60000;
    scope.DefaultProxyType = null;
    scope.DefaultForcedQuality = null;
    scope.DefaultProxyQuality = null;
}

declareOptions(window);

var TwitchAdblockSettings = {
    BannerVisible: true,
    ForcedQuality: null,
    ProxyType: null,
    ProxyQuality: null,
    AdTime: 0
};

var twitchWorkers = [];
var adBlockDiv = null;
var OriginalVideoPlayerQuality = null;
var IsPlayerAutoQuality = null;
const oldWorker = window.Worker;

window.Worker = class Worker extends oldWorker {
    constructor(twitchBlobUrl) {
        console.debug('Worker created: ' + twitchBlobUrl);
        var jsURL = getWasmWorkerUrl(twitchBlobUrl);
        if (typeof jsURL !== 'string') {
            super(twitchBlobUrl);
            return;
        }
        var newBlobStr = `
            ${getStreamUrlForResolution.toString()}
            ${getStreamForResolution.toString()}
            ${stripUnusedParams.toString()}
            ${processM3U8.toString()}
            ${hookWorkerFetch.toString()}
            ${declareOptions.toString()}
            ${getAccessToken.toString()}
            ${gqlRequest.toString()}
            ${adRecordgqlPacket.toString()}
            ${tryNotifyTwitch.toString()}
            ${parseM3U8EntryDesc.toString()}
            declareOptions(self);
            self.TwitchAdblockSettings = ${JSON.stringify(TwitchAdblockSettings)};
            self.addEventListener('message', function(e) {
                if (e.data.key == 'UpdateIsSquadStream') {
                    IsSquadStream = e.data.value;
                } else if (e.data.key == 'UpdateClientVersion') {
                    ClientVersion = e.data.value;
                } else if (e.data.key == 'UpdateClientSession') {
                    ClientSession = e.data.value;
                } else if (e.data.key == 'UpdateClientId') {
                    ClientID = e.data.value;
                } else if (e.data.key == 'UpdateDeviceId') {
                    GQLDeviceID = e.data.value;
                }
            });
            hookWorkerFetch();
            importScripts('${jsURL}');
        `;
        super(URL.createObjectURL(new Blob([newBlobStr])));
        twitchWorkers.push(this);
        // Intercept messages to twitches worker
        this.onmessage = function(e) {
            if (e.data.key == 'ShowAdBlockBanner') {
                if (!TwitchAdblockSettings.BannerVisible) {
                    return;
                }
                if (adBlockDiv == null) {
                    adBlockDiv = getAdBlockDiv();
                }
                adBlockDiv.P.textContent = 'Blocking ads...';
                adBlockDiv.style.display = 'block';

                //setting data-start-time as starting time of ad blocking
                let startTime = adBlockDiv.getAttribute('data-start-time');
                if (!startTime || startTime == 'null') {
                    adBlockDiv.setAttribute('data-start-time', new Date().toISOString());
                }
            } else if (e.data.key == 'HideAdBlockBanner') {
                if (adBlockDiv == null) {
                    adBlockDiv = getAdBlockDiv();
                }
                adBlockDiv.style.display = 'none';

                // calculate duration of last ads
                let startTime = adBlockDiv.getAttribute('data-start-time');
                if (startTime) {
                    startTime = new Date(startTime);
                    let duration = Math.round((new Date() - startTime) / 1000);
                    
                    if (isNaN(duration) || duration < 1) {
                        console.log(`Duration (${duration}) is invalid, not saving time.`);
                        return;
                    }
                    TwitchAdblockSettings.AdTime += duration;
                    // post message to content.js to save adtime in local storage
                    postMessage({
                        type: 'SetTwitchAdTime',
                        adtime: TwitchAdblockSettings.AdTime
                    }, '*');

                    adBlockDiv.setAttribute('data-start-time', null);
                }
            } else if (e.data.key == 'PauseResumePlayer') {
                doTwitchPlayerTask(true, false, false, false, false);
            } else if (e.data.key == 'ForceChangeQuality') {
                //This is used to fix the bug where the video would freeze.
                try {
                    if (navigator.userAgent.toLowerCase().indexOf('firefox') == -1) {
                        return;
                    }
                    var autoQuality = doTwitchPlayerTask(false, false, false, true, false);
                    var currentQuality = doTwitchPlayerTask(false, true, false, false, false);

                    if (IsPlayerAutoQuality == null) {
                        IsPlayerAutoQuality = autoQuality;
                    }
                    if (OriginalVideoPlayerQuality == null) {
                        OriginalVideoPlayerQuality = currentQuality;
                    }
                    if (!currentQuality.includes('360') || e.data.value != null) {
                        if (!OriginalVideoPlayerQuality.includes('360')) {
                            var settingsMenu = document.querySelector('div[data-a-target="player-settings-menu"]');
                            if (settingsMenu == null) {
                                var settingsCog = document.querySelector('button[data-a-target="player-settings-button"]');
                                if (settingsCog) {
                                    settingsCog.click();
                                    var qualityMenu = document.querySelector('button[data-a-target="player-settings-menu-item-quality"]');
                                    if (qualityMenu) {
                                        qualityMenu.click();
                                    }
                                    var lowQuality = document.querySelectorAll('input[data-a-target="tw-radio"');
                                    if (lowQuality) {
                                        var qualityToSelect = lowQuality.length - 2;
                                        if (e.data.value != null) {
                                            if (e.data.value.includes('original')) {
                                                e.data.value = OriginalVideoPlayerQuality;
                                                if (IsPlayerAutoQuality) {
                                                    e.data.value = 'auto';
                                                }
                                            }
                                            if (e.data.value.includes('160p')) {
                                                qualityToSelect = 5;
                                            }
                                            if (e.data.value.includes('360p')) {
                                                qualityToSelect = 4;
                                            }
                                            if (e.data.value.includes('480p')) {
                                                qualityToSelect = 3;
                                            }
                                            if (e.data.value.includes('720p')) {
                                                qualityToSelect = 2;
                                            }
                                            if (e.data.value.includes('822p')) {
                                                qualityToSelect = 2;
                                            }
                                            if (e.data.value.includes('864p')) {
                                                qualityToSelect = 2;
                                            }
                                            if (e.data.value.includes('900p')) {
                                                qualityToSelect = 2;
                                            }
                                            if (e.data.value.includes('936p')) {
                                                qualityToSelect = 2;
                                            }
                                            if (e.data.value.includes('960p')) {
                                                qualityToSelect = 2;
                                            }
                                            if (e.data.value.includes('1080p')) {
                                                qualityToSelect = 2;
                                            }
                                            if (e.data.value.includes('source')) {
                                                qualityToSelect = 1;
                                            }
                                            if (e.data.value.includes('auto')) {
                                                qualityToSelect = 0;
                                            }
                                        }
                                        var currentQualityLS = window.localStorage.getItem('video-quality');
                                        
                                        lowQuality[qualityToSelect].click();
                                        settingsCog.click();
                                        window.localStorage.setItem('video-quality', currentQualityLS);

                                        if (e.data.value != null) {
                                            OriginalVideoPlayerQuality = null;
                                            IsPlayerAutoQuality = null;
                                            doTwitchPlayerTask(false, false, false, true, true);
                                        }
                                    }

                                }
                            }
                        }
                    }
                } catch (err) {
                    OriginalVideoPlayerQuality = null;
                    IsPlayerAutoQuality = null;
                }
            }
        };

        function getAdBlockDiv() {
            //To display a notification to the user, that an ad is being blocked.
            var playerRootDiv = document.querySelector('.video-player');
            var adBlockDiv = null;
            if (playerRootDiv != null) {
                adBlockDiv = playerRootDiv.querySelector('.adblock-overlay');
                if (adBlockDiv == null) {
                    adBlockDiv = document.createElement('div');
                    adBlockDiv.className = 'adblock-overlay';
                    adBlockDiv.innerHTML = '<div class="player-adblock-notice" style="color: white; background-color: rgba(0, 0, 0, 0.8); position: absolute; top: 0px; left: 0px; padding: 5px;"><p></p></div>';
                    adBlockDiv.style.display = 'none';
                    adBlockDiv.P = adBlockDiv.querySelector('p');
                    playerRootDiv.appendChild(adBlockDiv);
                }
            }
            return adBlockDiv;
        }
    }
};

function getWasmWorkerUrl(twitchBlobUrl) {
    var req = new XMLHttpRequest();
    req.open('GET', twitchBlobUrl, false);
    req.send();
    return req.responseText.split("'")[1];
}

function hookWorkerFetch() {
    console.log('Twitch adblocker is enabled');
    const realFetch = fetch;
    fetch = async function(url, options) {
        if (typeof url === 'string') {
            // Fetching m3u8 info file for stream.
            if (url.includes('video-weaver')) {
                console.debug('video-weaver' + '\n' + url);
                return new Promise(function(resolve, reject) {
                    realFetch(url, options).then(async response => {
                        //Here we check the m3u8 for any ads and also try fallback player types if needed.

                        const responseText = await response.text();
                        let weaverText = null;

                        weaverText = await processM3U8(url, responseText, realFetch, PLAYER_TYPE_EMBED);
                        if (weaverText.includes(AdSignifier)) {
                            weaverText = await processM3U8(url, responseText, realFetch, PLAYER_TYPE_PROXY);
                        }
                        if (weaverText.includes(AdSignifier)) {
                            weaverText = await processM3U8(url, responseText, realFetch, PLAYER_TYPE_AUTOPLAY);
                        }

                        resolve(new Response(weaverText));
                    }).catch(err => {
                        reject(err);
                    });
                });
            // Fetching m3u8 info file for stream.
            } else if (url.includes('/api/channel/hls/')) {
                console.debug('/api/channel/hls/' + '\n' + url);
                const parsedUrl = new URL(url);
                const channelName = parsedUrl.pathname.match(/([^\/]+)(?=\.\w+$)/)[0];
                UsherParams = parsedUrl.search;
                CurrentChannelName = channelName;
                //To prevent pause/resume loop for mid-rolls.
                if (url.includes('picture-by-picture')) {
                    url = '';
                }
                return new Promise(function(resolve, reject) {
                    realFetch(url, options).then(response => {
                        if (response.status == 200) {
                            response.text().then(encodingsM3u8 => {
                                let streamInfo = StreamInfos[channelName];
                                if (streamInfo == null) {
                                    StreamInfos[channelName] = streamInfo = {};
                                }
                                streamInfo.ChannelName = channelName;
                                streamInfo.Urls = [];// xxx.m3u8 -> { Resolution: "284x160", FrameRate: 30.0 }
                                streamInfo.EncodingsM3U8Cache = [];
                                streamInfo.EncodingsM3U8 = encodingsM3u8;
                                const lines = encodingsM3u8.replace('\r', '').split('\n');
                                for (let i = 0; i < lines.length; i++) {
                                    if (!lines[i].startsWith('#') && lines[i].includes('.m3u8')) {
                                        streamInfo.Urls[lines[i]] = -1;
                                        if (i > 0 && lines[i - 1].startsWith('#EXT-X-STREAM-INF')) {
                                            const attributes = parseM3U8EntryDesc(lines[i - 1]);
                                            const resolution = attributes['RESOLUTION'];
                                            if (resolution) {
                                                streamInfo.Urls[lines[i]] = {
                                                    Resolution: resolution,
                                                    FrameRate: attributes['FRAME-RATE']
                                                };
                                            }
                                        }
                                        StreamInfosByUrl[lines[i]] = streamInfo;
                                        MainUrlByUrl[lines[i]] = url;
                                    }
                                }
                                resolve(new Response(encodingsM3u8));
                            });
                        } else {
                            resolve(response);
                        }
                    }).catch(err => {
                        reject(err);
                    });
                });
            }
        }
        return realFetch.apply(this, arguments);
    };
}

function getStreamUrlForResolution(encodingsM3u8, resolutionInfo, qualityOverrideStr) {
    var qualityOverride = 0;
    if (qualityOverrideStr && qualityOverrideStr.endsWith('p')) {
        qualityOverride = qualityOverrideStr.substr(0, qualityOverrideStr.length - 1) | 0;
    }
    var qualityOverrideFoundQuality = 0;
    var qualityOverrideFoundFrameRate = 0;
    var encodingsLines = encodingsM3u8.replace('\r', '').split('\n');
    var firstUrl = null;
    var lastUrl = null;
    var matchedResolutionUrl = null;
    var matchedFrameRate = false;
    for (var i = 0; i < encodingsLines.length; i++) {
        if (!encodingsLines[i].startsWith('#') && encodingsLines[i].includes('.m3u8')) {
            if (i > 0 && encodingsLines[i - 1].startsWith('#EXT-X-STREAM-INF')) {
                var attributes = parseM3U8EntryDesc(encodingsLines[i - 1]);
                var resolution = attributes['RESOLUTION'];
                var frameRate = attributes['FRAME-RATE'];
                if (resolution) {
                    if (qualityOverride) {
                        var quality = resolution.toLowerCase().split('x')[1];
                        if (quality == qualityOverride) {
                            qualityOverrideFoundQuality = quality;
                            qualityOverrideFoundFrameRate = frameRate;
                            matchedResolutionUrl = encodingsLines[i];
                            if (frameRate < 40) {
                                //console.log(`qualityOverride(A) quality:${quality} frameRate:${frameRate}`);
                                return matchedResolutionUrl;
                            }
                        } else if (quality < qualityOverride) {
                            //if (matchedResolutionUrl) {
                            //    console.log(`qualityOverride(B) quality:${qualityOverrideFoundQuality} frameRate:${qualityOverrideFoundFrameRate}`);
                            //} else {
                            //    console.log(`qualityOverride(C) quality:${quality} frameRate:${frameRate}`);
                            //}
                            return matchedResolutionUrl ? matchedResolutionUrl : encodingsLines[i];
                        }
                    } else if ((!resolutionInfo || resolution == resolutionInfo.Resolution) &&
                               (!matchedResolutionUrl || (!matchedFrameRate && frameRate == resolutionInfo.FrameRate))) {
                        matchedResolutionUrl = encodingsLines[i];
                        matchedFrameRate = frameRate == resolutionInfo.FrameRate;
                        if (matchedFrameRate) {
                            return matchedResolutionUrl;
                        }
                    }
                }
                if (firstUrl == null) {
                    firstUrl = encodingsLines[i];
                }
                lastUrl = encodingsLines[i];
            }
        }
    }
    if (qualityOverride) {
        return lastUrl;
    }
    return matchedResolutionUrl ? matchedResolutionUrl : firstUrl;
}

async function getStreamForResolution(streamInfo, resolutionInfo, encodingsM3u8, fallbackStreamStr, playerType, realFetch) {
    var qualityOverride = null;
    if (playerType === 'proxy') {
        qualityOverride = TwitchAdblockSettings.ProxyQuality ? TwitchAdblockSettings.ProxyQuality : DefaultProxyQuality;
    }
    if (streamInfo.EncodingsM3U8Cache[playerType].Resolution != resolutionInfo.Resolution ||
        streamInfo.EncodingsM3U8Cache[playerType].RequestTime < Date.now() - EncodingCacheTimeout) {
        console.log(`Blocking ads (type:${playerType}, resolution:${resolutionInfo.Resolution}, frameRate:${resolutionInfo.FrameRate}, qualityOverride:${qualityOverride})`);
    }
    streamInfo.EncodingsM3U8Cache[playerType].RequestTime = Date.now();
    streamInfo.EncodingsM3U8Cache[playerType].Value = encodingsM3u8;
    streamInfo.EncodingsM3U8Cache[playerType].Resolution = resolutionInfo.Resolution;
    var streamM3u8Url = getStreamUrlForResolution(encodingsM3u8, resolutionInfo, qualityOverride);
    var streamM3u8Response = await realFetch(streamM3u8Url);
    if (streamM3u8Response.status == 200) {
        var m3u8Text = await streamM3u8Response.text();
        WasShowingAd = true;
        postMessage({
            key: 'ShowAdBlockBanner'
        });
        postMessage({
            key: 'ForceChangeQuality'
        });

        if (!m3u8Text || m3u8Text.includes(AdSignifier)) {
            streamInfo.EncodingsM3U8Cache[playerType].Value = null;
        }

        return m3u8Text;
    } else {
        streamInfo.EncodingsM3U8Cache[playerType].Value = null;
        return fallbackStreamStr;
    }
}

function stripUnusedParams(str, params) {
    if (!params) {
        params = [ 'token', 'sig' ];
    }
    var tempUrl = new URL('https://localhost/' + str);
    for (var i = 0; i < params.length; i++) {
        tempUrl.searchParams.delete(params[i]);
    }
    return tempUrl.pathname.substring(1) + tempUrl.search;
}

async function processM3U8(url, textStr, realFetch, fallbackPlayer) {
    //Checks the m3u8 for ads and if it finds one, instead returns the m3u8 from the fallback

    const streamInfo = StreamInfosByUrl[url];
    
    //Ad blocking for squad streams is disabled due to the way multiple weaver urls are used. No workaround so far.
    if (IsSquadStream == true) {
        return textStr;
    }

    if (!textStr) {
        return textStr;
    }

    //Some live streams use mp4.
    if (!textStr.includes('.ts') && !textStr.includes('.mp4')) {
        return textStr;
    }

    // Includes ads
    if (textStr.includes(AdSignifier)) {
        console.debug("Ads detected in " + url + "\n" + textStr);

        let currentResolution = null;
        if (streamInfo && streamInfo.Urls) {
            for (const [resUrl, resInfo] of Object.entries(streamInfo.Urls)) {
                if (resUrl == url) {
                    currentResolution = resInfo;
                    break;
                }
            }
        }
        
        // Keep the m3u8 around for a little while (once per ad) before requesting a new one
        const encodingsM3U8Cache = streamInfo.EncodingsM3U8Cache[fallbackPlayer];
        if (encodingsM3U8Cache) {
            if (encodingsM3U8Cache.Value && encodingsM3U8Cache.RequestTime >= Date.now() - EncodingCacheTimeout) {
                try {
                    var result = getStreamForResolution(streamInfo, currentResolution, encodingsM3U8Cache.Value, null, fallbackPlayer, realFetch);
                    if (result) {
                        return result;
                    }
                } catch (err) {
                    encodingsM3U8Cache.Value = null;
                }
            }
        } else {
            streamInfo.EncodingsM3U8Cache[fallbackPlayer] = {
                RequestTime: Date.now(),
                Value: null,
                Resolution: null
            };
        }
        
        if (fallbackPlayer === 'proxy') {
            try {
                var proxyType = TwitchAdblockSettings.ProxyType ? TwitchAdblockSettings.ProxyType : DefaultProxyType;
                var encodingsM3u8Response = null;
                /*var tempUrl = stripUnusedParams(MainUrlByUrl[url]);
                const match = /(hls|vod)\/(.+?)$/gim.exec(tempUrl);*/
                switch (proxyType) {
                    case 'TTV LOL':
                        encodingsM3u8Response = await realFetch('https://api.ttv.lol/playlist/' + CurrentChannelName + '.m3u8%3Fallow_source%3Dtrue'/* + encodeURIComponent(match[2])*/, {headers: {'X-Donate-To': 'https://ttv.lol/donate'}});
                        break;
                    /*case 'Purple Adblock':// Broken...
                        encodingsM3u8Response = await realFetch('https://eu1.jupter.ga/channel/' + CurrentChannelName);*/
                    case 'Falan':// https://greasyfork.org/en/scripts/425139-twitch-ad-fix/code
                        encodingsM3u8Response = await realFetch(atob('aHR0cHM6Ly9qaWdnbGUuYmV5cGF6YXJpZ3VydXN1LndvcmtlcnMuZGV2') + '/hls/' + CurrentChannelName + '.m3u8%3Fallow_source%3Dtrue'/* + encodeURIComponent(match[2])*/);
                        break;
                }
                if (encodingsM3u8Response && encodingsM3u8Response.status === 200) {
                    return getStreamForResolution(streamInfo, currentResolution, await encodingsM3u8Response.text(), textStr, fallbackPlayer, realFetch);
                }
            } catch (err) {}
            return textStr;
        }
        
        var accessTokenResponse = await getAccessToken(CurrentChannelName, fallbackPlayer);
        if (accessTokenResponse.status === 200) {
            var accessToken = await accessTokenResponse.json();
            try {
                var urlInfo = new URL('https://usher.ttvnw.net/api/channel/hls/' + CurrentChannelName + '.m3u8' + UsherParams);
                urlInfo.searchParams.set('sig', accessToken.data.streamPlaybackAccessToken.signature);
                urlInfo.searchParams.set('token', accessToken.data.streamPlaybackAccessToken.value);
                var encodingsM3u8Response = await realFetch(urlInfo.href);
                if (encodingsM3u8Response.status === 200) {
                    return getStreamForResolution(streamInfo, currentResolution, await encodingsM3u8Response.text(), textStr, fallbackPlayer, realFetch);
                } else {
                    return textStr;
                }
            } catch (err) {}
            return textStr;
        } else {
            return textStr;
        }
    } else {
        if (WasShowingAd) {
            console.log('Finished blocking ads');
            WasShowingAd = false;
            //Here we put player back to original quality and remove the blocking message.
            postMessage({
                key: 'ForceChangeQuality',
                value: 'original'
            });
            postMessage({
                key: 'PauseResumePlayer'
            });
            postMessage({
                key: 'HideAdBlockBanner'
            });
        }
        return textStr;
    }
}

function parseM3U8EntryDesc(str) {
    return Object.fromEntries(
        str.split(/(?:^|,)((?:[^=]*)=(?:"[^"]*"|[^,]*))/)
        .filter(Boolean)
        .map(x => {
            const idx = x.indexOf('=');
            const key = x.substring(0, idx);
            const value = x.substring(idx + 1);
            const num = Number(value);
            return [key, Number.isNaN(num) ? (value.startsWith('"') ? JSON.parse(value) : value) : num];
        }));
}

async function tryNotifyTwitch(streamM3u8) {
    //We notify that an ad was requested but was not visible and was also muted.
    var matches = streamM3u8.match(/#EXT-X-DATERANGE:(ID="stitched-ad-[^\n]+)\n/);
    if (matches.length > 1) {
        const attrString = matches[1];
        const attr = parseM3U8EntryDesc(attrString);
        var podLength = parseInt(attr['X-TV-TWITCH-AD-POD-LENGTH'] ? attr['X-TV-TWITCH-AD-POD-LENGTH'] : '1');
        var podPosition = parseInt(attr['X-TV-TWITCH-AD-POD-POSITION'] ? attr['X-TV-TWITCH-AD-POD-POSITION'] : '0');
        var radToken = attr['X-TV-TWITCH-AD-RADS-TOKEN'];
        var lineItemId = attr['X-TV-TWITCH-AD-LINE-ITEM-ID'];
        var orderId = attr['X-TV-TWITCH-AD-ORDER-ID'];
        var creativeId = attr['X-TV-TWITCH-AD-CREATIVE-ID'];
        var adId = attr['X-TV-TWITCH-AD-ADVERTISER-ID'];
        var rollType = attr['X-TV-TWITCH-AD-ROLL-TYPE'].toLowerCase();
        const baseData = {
            stitched: true,
            roll_type: rollType,
            player_mute: true,
            player_volume: 0.0,
            visible: false,
        };
        for (let podPosition = 0; podPosition < podLength; podPosition++) {
            const extendedData = {
                ...baseData,
                ad_id: adId,
                ad_position: podPosition,
                duration: 0,
                creative_id: creativeId,
                total_ads: podLength,
                order_id: orderId,
                line_item_id: lineItemId,
            };
            await gqlRequest(adRecordgqlPacket('video_ad_impression', radToken, extendedData));
            for (let quartile = 0; quartile < 4; quartile++) {
                await gqlRequest(
                    adRecordgqlPacket('video_ad_quartile_complete', radToken, {
                        ...extendedData,
                        quartile: quartile + 1,
                    })
                );
            }
            await gqlRequest(adRecordgqlPacket('video_ad_pod_complete', radToken, baseData));
        }
    }
}

function adRecordgqlPacket(event, radToken, payload) {
    return [{
        operationName: 'ClientSideAdEventHandling_RecordAdEvent',
        variables: {
            input: {
                eventName: event,
                eventPayload: JSON.stringify(payload),
                radToken,
            },
        },
        extensions: {
            persistedQuery: {
                version: 1,
                sha256Hash: '7e6c69e6eb59f8ccb97ab73686f3d8b7d85a72a0298745ccd8bfc68e4054ca5b',
            },
        },
    }];
}

function getAccessToken(channelName, playerType, realFetch) {
    var body = null;
    var templateQuery = 'query PlaybackAccessToken_Template($login: String!, $isLive: Boolean!, $vodID: ID!, $isVod: Boolean!, $playerType: String!) {  streamPlaybackAccessToken(channelName: $login, params: {platform: "ios", playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isLive) {    value    signature    __typename  }  videoPlaybackAccessToken(id: $vodID, params: {platform: "ios", playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isVod) {    value    signature    __typename  }}';
    body = {
        operationName: 'PlaybackAccessToken_Template',
        query: templateQuery,
        variables: {
            'isLive': true,
            'login': channelName,
            'isVod': false,
            'vodID': '',
            'playerType': playerType
        }
    };
    return gqlRequest(body, realFetch);
}

function gqlRequest(body, realFetch) {
    var fetchFunc = realFetch ? realFetch : fetch;
    if (!GQLDeviceID) {
        var dcharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';
        var dcharactersLength = dcharacters.length;
        for (var i = 0; i < 32; i++) {
            GQLDeviceID += dcharacters.charAt(Math.floor(Math.random() * dcharactersLength));
        }
    }
    return fetchFunc('https://gql.twitch.tv/gql', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
            'Client-ID': ClientID,
            'Device-ID': GQLDeviceID,
            'X-Device-Id': GQLDeviceID,
            'Client-Version': ClientVersion,
            'Client-Session-Id': ClientSession
        }
    });
}

function doTwitchPlayerTask(isPausePlay, isCheckQuality, isCorrectBuffer, isAutoQuality, setAutoQuality) {
    //This will do an instant pause/play to return to original quality once the ad is finished.
    //We also use this function to get the current video player quality set by the user.
    //We also use this function to quickly pause/play the player when switching tabs to stop delays.
    try {
        var videoController = null;
        var videoPlayer = null;

        function findReactNode(root, constraint) {
            if (root.stateNode && constraint(root.stateNode)) {
                return root.stateNode;
            }
            let node = root.child;
            while (node) {
                const result = findReactNode(node, constraint);
                if (result) {
                    return result;
                }
                node = node.sibling;
            }
            return null;
        }
        var reactRootNode = null;
        var rootNode = document.querySelector('#root');
        if (rootNode?._reactRootContainer?._internalRoot?.current) {
            reactRootNode = rootNode._reactRootContainer._internalRoot.current;
        }
        videoPlayer = findReactNode(reactRootNode, node => node.setPlayerActive && node.props && node.props.mediaPlayerInstance);
        videoPlayer = videoPlayer?.props?.mediaPlayerInstance ? videoPlayer.props.mediaPlayerInstance : null;

        console.debug(videoPlayer);

        if (isPausePlay) {
            videoPlayer.pause();
            videoPlayer.play();
            return;
        }
        if (isCheckQuality) {
            if (typeof videoPlayer.getQuality() == 'undefined') {
                return;
            }
            var playerQuality = JSON.stringify(videoPlayer.getQuality());
            if (playerQuality) {
                return playerQuality;
            } else {
                return;
            }
        }
        if (isAutoQuality) {
            if (typeof videoPlayer.isAutoQualityMode() == 'undefined') {
                return false;
            }
            var autoQuality = videoPlayer.isAutoQualityMode();
            if (autoQuality) {
                videoPlayer.setAutoQualityMode(false);
                return autoQuality;
            } else {
                return false;
            }
        }
        if (setAutoQuality) {
            videoPlayer.setAutoQualityMode(true);
            return;
        }
        //This only happens when switching tabs and is to correct the high latency caused when opening background tabs and going to them at a later time.
        //We check that this is a live stream by the page URL, to prevent vod/clip pause/plays.
        try {
            var currentPageURL = document.URL;
            var isLive = true;
            if (currentPageURL.includes('videos/') || currentPageURL.includes('clip/')) {
                isLive = false;
            }
            if (isCorrectBuffer && isLive) {
                //A timer is needed due to the player not resuming without it.
                setTimeout(function() {
                    //If latency to broadcaster is above 5 or 15 seconds upon switching tabs, we pause and play the player to reset the latency.
                    //If latency is between 0-6, user can manually pause and resume to reset latency further.
                    if (videoPlayer.isLiveLowLatency() && videoPlayer.getLiveLatency() > 5) {
                        videoPlayer.pause();
                        videoPlayer.play();
                    } else if (videoPlayer.getLiveLatency() > 15) {
                        videoPlayer.pause();
                        videoPlayer.play();
                    }
                }, 3000);
            }
        } catch (err) {}
    } catch (err) {}
}

var localDeviceID = null;
localDeviceID = window.localStorage.getItem('local_copy_unique_id');

function hookFetch() {
    var realFetch = window.fetch;
    window.fetch = function(url, init, ...args) {
        if (typeof url === 'string') {
            //Check if squad stream.
            if (window.location.pathname.includes('/squad')) {
                for (const worker of twitchWorkers) {
                    worker.postMessage({
                        key: 'UpdateIsSquadStream',
                        value: true
                    });
                }
            } else {
                for (const worker of twitchWorkers) {
                    worker.postMessage({
                        key: 'UpdateIsSquadStream',
                        value: false
                    });
                }
            }
            if (url.includes('/access_token') || url.includes('gql')) {
                //Device ID is used when notifying Twitch of ads.
                let deviceId = init.headers['X-Device-Id'];
                if (typeof deviceId !== 'string') {
                    deviceId = init.headers['Device-ID'];
                }
                //Added to prevent eventual UBlock conflicts.
                if (typeof deviceId === 'string' && !deviceId.includes('twitch-web-wall-mason')) {
                    GQLDeviceID = deviceId;
                } else if (localDeviceID) {
                    GQLDeviceID = localDeviceID.replace('"', '');
                    GQLDeviceID = GQLDeviceID.replace('"', '');
                }
                if (GQLDeviceID && twitchWorkers.length > 0) {
                    if (typeof init.headers['X-Device-Id'] === 'string') {
                        init.headers['X-Device-Id'] = GQLDeviceID;
                    }
                    if (typeof init.headers['Device-ID'] === 'string') {
                        init.headers['Device-ID'] = GQLDeviceID;
                    }
                    for (const worker of twitchWorkers) {
                        worker.postMessage({
                            key: 'UpdateDeviceId',
                            value: GQLDeviceID
                        });
                    }
                }
                //Client version is used in GQL requests.
                var clientVersion = init.headers['Client-Version'];
                if (clientVersion && typeof clientVersion == 'string') {
                    ClientVersion = clientVersion;
                }
                if (ClientVersion && twitchWorkers.length > 0) {
                    for (const worker of twitchWorkers) {
                        worker.postMessage({
                            key: 'UpdateClientVersion',
                            value: ClientVersion
                        });
                    }
                }
                //Client session is used in GQL requests.
                let clientSession = init.headers['Client-Session-Id'];
                if (clientSession && typeof clientSession == 'string') {
                    ClientSession = clientSession;
                }
                if (ClientSession && twitchWorkers.length > 0) {
                    for (const worker of twitchWorkers) {
                        worker.postMessage({
                            key: 'UpdateClientSession',
                            value: ClientSession
                        });
                    }
                }
                //Client ID is used in GQL requests.
                if (url.includes('gql') && init && typeof init.body === 'string' && init.body.includes('PlaybackAccessToken')) {
                    var clientId = init.headers['Client-ID'];
                    if (clientId && typeof clientId == 'string') {
                        ClientID = clientId;
                    } else {
                        clientId = init.headers['Client-Id'];
                        if (clientId && typeof clientId == 'string') {
                            ClientID = clientId;
                        }
                    }
                    if (ClientID && twitchWorkers.length > 0) {
                        for (const worker of twitchWorkers) {
                            worker.postMessage({
                                key: 'UpdateClientId',
                                value: ClientID
                            });
                        }
                    }
                }
                //To prevent pause/resume loop for mid-rolls.
                if (url.includes('gql') && init && typeof init.body === 'string' && init.body.includes('PlaybackAccessToken') && init.body.includes('picture-by-picture')) {
                    init.body = '';
                }
                var isPBYPRequest = url.includes('picture-by-picture');
                if (isPBYPRequest) {
                    url = '';
                }
            }
        }
        return realFetch.apply(this, arguments);
    };
}
hookFetch();