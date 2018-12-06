#!/bin/bash

set -e
git add --all
git commit -m "WIP"
git push
ssh root@nanook.local "cd /opt/nanook-node ; ./update.sh"