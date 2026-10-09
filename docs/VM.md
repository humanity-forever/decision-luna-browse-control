# Local VM setup and measured environment

Comparisons run inside an ARM64 Ubuntu 24.04 KVM guest, with four vCPUs and 8GB RAM. Chromium is headless at 1440×900 and America/New_York browser timezone. A host-mounted source checkout makes the experiment reproducible without a paid external worker.

Use a Linux ARM64 host with `/dev/kvm`, QEMU virt with KVM acceleration, an Ubuntu ARM64 cloud image and local storage. Install Node 22, Chromium dependencies and FFmpeg inside the guest. Keep credentials in the guest user configuration directory with 0600 permissions, never in the source mount. Run the CLI from the mounted checkout and bind synthetic fixture servers to guest loopback only.

Do not run other browser jobs during timing comparisons. Code, task limits, resolution and model configurations must stay frozen; changing them starts a separately reported revision. Host-native execution is supported for reproduction, but must be labeled separately from these VM measurements. No paid cloud infrastructure is used.
