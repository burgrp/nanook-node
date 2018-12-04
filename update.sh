#!/bin/bash

systemctl stop nanook.service

set -e
git pull
npm update
systemctl start nanook.service
systemctl status nanook.service
journalctl -fu nanook.service