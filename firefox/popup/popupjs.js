'use strict';

const isChromium = typeof window.chrome !== 'undefined';
const isFirefox = typeof window.browser !== 'undefined';
const browser = isFirefox ? window.browser : window.chrome;

const onOff = document.querySelector('input[name=checkbox_ad]');
const blockingMessage = document.querySelector('input[name=checkbox_ad_msg]');
const forcedQuality = document.querySelector('select[name=dropdown_forced_quality]');
const proxy = document.querySelector('select[name=dropdown_proxy]');
const proxyQuality = document.querySelector('select[name=dropdown_proxy_quality]');
const adTime = document.querySelector('#ad_time');
const excludedChannels = document.querySelector('textarea[name=excluded_channels]');

const allSettingsElements = [onOff,blockingMessage,forcedQuality,proxy,proxyQuality,excludedChannels];

for (let i = 0; i < allSettingsElements.length; i++) {
    if (allSettingsElements[i]) {
        allSettingsElements[i].addEventListener('change', function() {
            saveOptions();
        });
    }
}

function saveOptions() {
    chrome.storage.local.set({onOffTTV: onOff.checked ? 'true' : 'false'});
    chrome.storage.local.set({blockingMessageTTV: blockingMessage.checked ? 'true' : 'false'});
    //chrome.storage.local.set({forcedQualityTTV: forcedQuality.options[forcedQuality.selectedIndex].text});
    chrome.storage.local.set({proxyTTV: proxy.options[proxy.selectedIndex].text});
    chrome.storage.local.set({proxyQualityTTV: proxyQuality.options[proxyQuality.selectedIndex].text});
    chrome.storage.local.set({excludedChannelsTTV: excludedChannels.value.replace(/\r|\s/g, "").replace("https://www.twitch.tv/", "").split("\n")});
}

function restoreOptions() {
    restoreToggle('onOffTTV', onOff);
    restoreToggle('blockingMessageTTV', blockingMessage);
    //restoreDropdown('forcedQualityTTV', forcedQuality);
    restoreDropdown('proxyTTV', proxy);
    restoreDropdown('proxyQualityTTV', proxyQuality);
    restoreAdtime('adTimeTTV', adTime);
    restoreTextArray('excludedChannelsTTV', excludedChannels, '\n');
}

function restoreToggle(name, toggle) {
    chrome.storage.local.get([name], function(result) {
        if (result[name]) {
            toggle.checked = result[name] == 'true';
        }
    });
}

function restoreDropdown(name, dropdown) {
    chrome.storage.local.get([name], function(result) {
        if (result[name]) {
            const items = Array.from(dropdown.options).filter(item => item.text == result[name]);
            if (items.length == 1) {
                dropdown.selectedIndex = items[0].index;
            }
        }
    });
}

function restoreAdtime(name, container) {
    chrome.storage.local.get([name], function(result) {
        if (result[name]) {
            // only display hours / minutes if needed
            const hours = Math.trunc(result[name] / 3600);
            const minutes = Math.trunc((result[name] - hours * 3600) / 60);
            container.innerText = `${hours>0 ? hours+"h " : ""}${minutes>0 ? minutes+"min " : ""}${result[name] % 60}s`;
        }
    });
}

function restoreTextArray(name, textArea, separator) {
    chrome.storage.local.get([name], function(result) {
        const loadedArray = result[name];
        if (loadedArray?.join) {
            textArea.value = loadedArray.join(separator);
        }
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);