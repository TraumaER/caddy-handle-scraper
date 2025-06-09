export type ServicesRequest = {
  host_ip: string;
  services: Array<Service>;
};

export type Service = {
  port: number;
  subdomain: string;
};
