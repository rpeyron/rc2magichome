#!/bin/bash

# If you update this, you will need to update also the .service file
DESTFOLDER=/usr/local/bin

# Check for node
if which node > /dev/null
then
    echo "Node found, installing required modules..."
else
    echo "Node not found"
    exit 1
fi

# Install modules
npm install

if [ ! -f "config.local.js" ]
then
    cp src/config.js config.local.js
    echo "Default config copied in config.local.js ; please update what you need and remove what you leave as default"
fi

# Install systemd service
sudo chmod +x main.js
sudo ln -sf $PWD/main.js $DESTFOLDER/rc2magichome.js
sudo systemctl stop rc2magichome.service || true
sudo systemctl enable ./rc2magichome.service
sudo systemctl daemon-reload
sudo systemctl start rc2magichome.service

echo "Installation done:"
sudo systemctl status rc2magichome.service

echo "You need to restart the daemon when you change the configuration"
