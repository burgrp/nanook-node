NANOOK main board js code

## Docker

Install binfmt
```shell
docker run --rm --privileged docker/binfmt:820fdd95a9972a5308930a2bdfb8573dd4447ad3
```

Build the image
```shell
docker buildx build --platform linux/arm/v7 . -t defa/nanook --push
```

## DEVICE.FARM

FS Overwrite:

/boot/armbianEnv.txt
```
verbosity=1
logo=disabled
console=serial
disp_mode=1920x1080p60
overlay_prefix=sun8i-h3
overlays=usbhost2 usbhost3
rootdev=UUID=29f9b1c5-1e15-4fa6-a6b8-124559d86198
rootfstype=ext4
```

```
docker pull defa/nanook
docker run -d --privileged --name nanook -e HTTP_PORT=80 -e I2C_BUS=hw:0 -e DATA_DIR=/data -p 80:80 -v /dev:/dev -v /data/nanook:/data defa/nanook:latest
```