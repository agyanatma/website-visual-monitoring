# Use MySQL for monitoring state

We will use MySQL to store monitored URLs, current monitoring state, latest check results, and alert delivery state. MySQL is preferred because an existing deployment is already available, which reduces operational complexity while still providing reliable persistence for a 24/7 monitor handling hundreds of public URLs.
