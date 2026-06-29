# Use light browser stealth for monitoring checks

We will use light browser stealth techniques from v1, including realistic mobile user agents, normal browser headers, locale/timezone settings, and a Playwright stealth plugin. This is acceptable because the monitored sites are owned or managed by the operator or clients, but v1 will avoid proxy rotation and CAPTCHA solving to keep the monitor simpler, cheaper, and less fragile.
