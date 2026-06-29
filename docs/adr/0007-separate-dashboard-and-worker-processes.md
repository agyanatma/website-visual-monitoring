# Separate dashboard and monitoring worker processes

We will run the monitoring dashboard and the monitoring worker as separate processes that both use MySQL. This isolates heavy Playwright/Chromium work from the web interface, making the 24/7 checker easier to restart and operate without taking down dashboard access when browser automation crashes or stalls.
