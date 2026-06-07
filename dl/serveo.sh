#!/bin/bash
exec ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R 80:127.0.0.1:3001 serveo.net
