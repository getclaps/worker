# Clap Button API Backend and Dashboard

The backend implementation for the [Clap Button](https://getclaps.dev/) web component.

It is written as a [Worker Environment](https://workers.js.org/) using [Worker Tools](https://worker-tools.github.io/) as a web framework, but it is mainly intended to be deployed using [Cloudflare Workers](https://workers.cloudflare.com). 

![Screenshot](https://getclaps.dev/assets/img/dashd.jpg)

## License
This software is licensed under the permissive MIT license, but
two sub-modules remain closed-source and are excluded from this distribution:

- The *Billing Module* has been removed to prevent launching of zero-effort competing services.
- The *Data Access Module* has been removed to hide the dependency on a proprietary database technology, and also prevent launching of zero-effort competing services.

Note that
- the billing module is an optional extension that is not required for running a personal Clap Button API backend. 
- the data access [interface](src/dao.ts) is included in this distribution and anyone is encouraged to provide their own implementation.

