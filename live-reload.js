(function() {
    let currentVersion = null;
    function checkVersion() {
        // Fetch the current version from the local server
        fetch('/live-reload-version.txt?t=' + Date.now())
            .then(res => {
                if (res.status === 200) {
                    return res.text();
                }
                throw new Error('Version file not available');
            })
            .then(version => {
                const cleanVersion = version.trim();
                if (currentVersion === null) {
                    currentVersion = cleanVersion;
                } else if (currentVersion !== cleanVersion) {
                    console.log('Update detected! Reloading page...');
                    window.location.reload();
                }
            })
            .catch(err => {
                // Silently handle errors if the server is temporarily down or file is missing
            });
    }
    // Check for updates every 1000ms
    setInterval(checkVersion, 1000);
})();
