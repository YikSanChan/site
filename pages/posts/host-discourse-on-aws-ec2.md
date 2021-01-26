---
title: Host Discourse on AWS EC2
date: 2020/12/02
description: The official guide only covers DigitalOcean. This post fills the gap.
tag: guide
author: Yik San Chan
---

# Host Discourse on AWS EC2

[This post](https://meta.discourse.org/t/guide-host-discourse-on-aws-ec2/172075) is originally posted on Discourse Community.

[Discourse](https://www.discourse.org/) is an open-source forum software that allows you to run a forum with minimal effort - if you know how to host it. The [official guide](https://github.com/discourse/discourse/blob/master/docs/INSTALL-cloud.md) walks through the installation on DigitalOcean, but it takes a few tweaks to get it to work on AWS EC2. There was an ask from the community for an official guide to install on AWS EC2, but the Discourse team [didn't have the experience](https://meta.discourse.org/t/document-for-installing-on-aws-ecs/37257) as they host on bare metal Linux servers.

This post aims to fill the gap by showing how to host Discourse on AWS EC2. Luckily, the only difference between hosting on AWS EC2 and hosting on DigitalOcean is on the very first part ["Create New Cloud Server"](https://github.com/discourse/discourse/blob/master/docs/INSTALL-cloud.md#create-new-cloud-server), so I will only cover that.

I assume you know how to spin up an AWS EC2 instance, if not, refer to some amazing Youtube videos. Besides the normal flow, there are a few things to note.

## Elastic IP

Configure an elastic IP because it is more static than the EC2 public IPs. The latter changes every time you stop-and-start the instance. A static IP makes the DNS resolving less error-prone.

## Disk space

The docker container needs quite some disk space because it runs Redis and PostgreSQL. The default 8 GiB EBS (Elastic Block Store) block is not enough. I configure a 30 GiB block.

If you have already configured the default 8 GiB block, no worry, simply change it on AWS console, then stop-and-start the instance. Now you know why do we need the elastic IP - it won't change after the restart, and the DNS resolution is not affected!

## Inbound rules

Make sure you open port 80 and 443 to source 0.0.0.0/0 in inbound rules. I leave them wide open for simplicity, but feel free to scope it properly.

## Conclusion

If you still have any question regarding hosting Discourse on AWS EC2, feel free to at me `@yiksanchan` on [https://meta.discourse.org/](https://meta.discourse.org/) and I will help if I can.

Happy discoursing!

---
