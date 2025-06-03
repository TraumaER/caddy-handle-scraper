import Docker from 'dockerode';
import net from 'net';

const main = async () => {
  const docker = new Docker();
  const serverURL = process.env.CHS_SERVER_URL;
  const subdomainLabel = process.env.CHS_SUBDOMAIN_LABEL ?? 'app.subdomain';
  const subdomainPortLabel =
    process.env.CHS_SUBDOMAIN_LABEL_PORT ?? `${subdomainLabel}.port`;

  const containersWithLabel = await docker.listContainers({
    filters: {
      label: [subdomainLabel],
      status: ['running'],
    },
  });

  const payload = containersWithLabel.map((container) => {
    return {
      subdomain: container.Labels[subdomainLabel],
      port: container.Labels[subdomainPortLabel]
        ? Number(container.Labels[subdomainPortLabel])
        : container.Ports.filter((port) => net.isIPv4(port.IP))[0].PublicPort,
    };
  });

  try {
    if (!serverURL) {
      throw new Error('Server URL is not defined');
    }
    const response = await fetch(`${serverURL}/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Handshake-Key': process.env.CHS_HANDSHAKE_KEY || '',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to send payload:', error);
  }
};

let intervalId: NodeJS.Timeout;

const startInterval = () => {
  console.log('Starting container monitoring...');
  main();
  intervalId = setInterval(main, 30000);
};

const cleanup = () => {
  if (intervalId) {
    clearInterval(intervalId);
    console.log('\nStopping container monitoring...');
  }
  process.exit(0);
};
['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGUSR2'].forEach((signal) => {
  process.on(signal, cleanup);
});

startInterval();
