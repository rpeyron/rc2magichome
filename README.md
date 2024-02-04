# Installation

Follow these steps:
```sh
git clone https://github.com/rpeyron/rc2magichome
sudo sh install.sh
```

The install script will:
- Check if node is install
- Install required node modules
- Copy default configuration if none exists (see configuration below)
- Create symbolic link in /usr/local/bin
- Register systemd start script
- Start rc2magichome


# Configuration

To configure, please update config.local.js (local file, will not be updated by upstream updates)
You should remove any default configuration and only keep the one you need to modify.
You need to restart the systemd after any configuration update with `systemctl restart rc2magichome.service` 
