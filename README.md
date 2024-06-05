<p align="center">
    <img src="https://user-images.githubusercontent.com/32986026/197740236-78fe908c-4fd1-4721-82f8-7e66ffdef2d1.png" alt="Banner">
</p>

# Twitch Adblock
Twitch Adblock blocks ads on Twitch by switching to an ad-free version of the stream at 480p during the ad-time and automatically switches back to the original video quality after the ad-time is over. This is 100% done locally, no proxies/VPNs or 3rd party scripts/websites are being used. This extension does not collect/share any of your personal information and the code is public. 

It is recommended to use this extension along with UBlock Origin.

Sourcecode: https://github.com/LukeTheVirus/VideoAdBlockForTwitch

The original author of this extension is "saucettv". This extension will always stay donation- and referral-link free.

# Manual Installation Steps
>### Chrome
>- [Download the latest .ZIP Archive](https://github.com/LukeTheVirus/VideoAdBlockForTwitch/archive/refs/heads/master.zip)
>- Extract the ZIP Archive to somewhere permanent (If the created folder is deleted, these steps need to be repeated)
>- Open up Chrome and in your Web Browser URL, enter: [`chrome://extensions`](chrome://extensions)
>- Enable the `Developer Mode` toggle, found in the top right of this view (typically) of the extensions page in your browser.
>- Click `Load unpacked Extension`
>- Navigate into the extracted folder from the ZIP Archive and select the folder `chrome`.
>- Thats it!

>### Firefox
>- [Download the latest .ZIP Archive](https://github.com/LukeTheVirus/VideoAdBlockForTwitch/archive/refs/heads/master.zip)
>- Extract the ZIP Archive to somewhere permanent (If the created folder is deleted, these steps need to be repeated)
>- Open up Firefox and in your Web Browser URL, enter: [`about:debugging#/runtime/this-firefox`](about:debugging#/runtime/this-firefox)
>- Under `Temporary Extensions`, Click `Load Temporary Add-on`
>- Navigate into the extracted folder from the ZIP Archive and in the folder `firefox`, select `manifest.json`.
>- Thats it!

# Changelog
- v5.3.5
    - `removed the URL grabber, Amazon referral link and Donation-Stuff from the original coder`
- v5.3.6
    - `updated manifest.json`
- v5.3.7
    - `updated to Manifest v3`
- v5.3.8
    - `updated extension menu`
    - `added GitHub & Discord link to the extension menu`
- v5.3.9
    - `fixed "Show/Hide 'Blocking Ads'-message logic`
- v5.4.0 (Chrome) / v5.4.1 (Firefox)
    - `applied fix for the 360p quality issue` (thanks [@pixeltris](https://github.com/pixeltris))
- v5.5.0
    - `Added proxies/embeds in order to fight the purple screen "Commercial break"` (thanks to [@pixeltris](https://github.com/pixeltris))
- v5.5.0
    - `Updated Logos etc.`)
- v5.7.0
    - `Added Adblock-Timer` (thanks to [@GODrums](https://github.com/GODrums))

# Credits
- [@saucettv](https://github.com/saucettv) (original Author)
- [@mikirobles](https://github.com/mikirobles) (removed Donation/Amazon stuff)
- [@pwltr](https://github.com/pwltr) (added the GPL-License & helped with updating to Manifest v3)
- [@HatterTheMadd](https://github.com/hatterthemadd) (helped with updating to Manifest v3)
- [@kdjmonaghan](https://github.com/kdjmonaghan) (added clearer install instructions for less advanced users)
- [@LukeTheVirus](https://github.com/LukeTheVirus) Current maintainer on this fork
