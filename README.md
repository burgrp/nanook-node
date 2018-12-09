# Raspi installation

```
docker run --name nanook --restart=always -d -p 81:8080 -v /data/nanook:/opt/app -e APP_DIR=/opt/app -e APP_START="node src/main.js" -e REPOSITORY=https://github.com/burgrp/nanook-node.git burgrp/npg-rpi
```
