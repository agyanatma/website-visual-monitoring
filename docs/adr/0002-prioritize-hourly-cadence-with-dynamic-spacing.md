# Prioritize hourly check cadence with dynamic spacing

Each monitored URL should be checked roughly once per hour, and checks should be spread across the hour instead of started in bursts. The spacing between check starts will be derived from the number of active monitored URLs, because a fixed one-minute spacing would fail to keep an hourly cadence once there are more than sixty URLs.
