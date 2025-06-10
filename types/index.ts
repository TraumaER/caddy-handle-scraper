/**
 * Represents a request to register or update services
 * @typedef {Object} ServicesRequest
 * @property {string} host_ip - The IP address of the host machine
 * @property {Array<Service>} services - Array of services to register or update
 */
export type ServicesRequest = {
  host_ip: string;
  services: Array<Service>;
};

/**
 * Represents a service with port and subdomain
 * @typedef {Object} Service
 * @property {number} port - The port number the service is running on
 * @property {string} subdomain - The subdomain for accessing the service
 */
export type Service = {
  port: number;
  subdomain: string;
};

/**
 * Represents a service record in the database
 * @typedef {Object} ServiceRow
 * @property {string} created_at - ISO timestamp when the service was created
 * @property {string} host_ip - The IP address of the host machine
 * @property {number} port - The port number the service is running on
 * @property {string} subdomain - The subdomain for accessing the service
 * @property {string} updated_at - ISO timestamp when the service was last updated
 */
export type ServiceRow = {
  created_at: string;
  host_ip: string;
  port: number;
  subdomain: string;
  updated_at: string;
};
