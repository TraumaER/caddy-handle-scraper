# caddy-handle-scraper

Automate creation of subdomain handlers for docker containers

## Server

In your homelab setup you will only need to run one server along-side your Caddy container.

### Description

### Environment Variables

| Variable          | Required? | Type     | Default | Description                                                                                                     |
| ----------------- | --------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| CHS_HANDSHAKE_KEY | ✅        | `string` |         | Unique key for simple server/client authentication. Utility script `yarn handshake` will generate a key for you |
| CHS_PORT          | ❌        | `number` | `3030`  | What port the server should listen on.                                                                          |

## Client

The client can be run on whatever machines you have docker containers running in that you want to generate handlers for.

### Description

### Environment Variables

| Variable                 | Required? | Type     | Default                       | Description                                                                                                     |
| ------------------------ | --------- | -------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| CHS_HANDSHAKE_KEY        | ✅        | `string` |                               | Unique key for simple server/client authentication. Utility script `yarn handshake` will generate a key for you |
| CHS_SERVER_URL           | ✅        | `string` |                               | Base url to reach the server. E.g. `http://192.168.10.100:3030`                                                 |
| CHS_SUBDOMAIN_LABEL      | ❌        | `string` | `app.subdomain`               | Which label to scrape for on your docker containers.                                                            |
| CHS_SUBDOMAIN_LABEL_PORT | ❌        | `string` | `${CHS_SUBDOMAIN_LABEL}.port` | When defining multiple port bindings, e.g. 80 & 443, the value of this label will be used for the handler.      |
| CHS_HOST_IP              | ❌        | `string` | `127.0.0.1`                   | The IP address that will be used in the reverse proxy. Should be the IPv4 of the client machine                 |
