const platform = () => "darwin";

const cpus = () => [
  { model: "CPU", speed: 2400, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } },
];

const homedir = () => "/home/user";
const tmpdir = () => "/tmp";
const hostname = () => "localhost";
const type = () => "Darwin";
const release = () => "20.0.0";
const arch = () => "x64";
const totalmem = () => 8 * 1024 * 1024 * 1024;
const freemem = () => 4 * 1024 * 1024 * 1024;
const EOL = "\n";

export {
  platform,
  cpus,
  homedir,
  tmpdir,
  hostname,
  type,
  release,
  arch,
  totalmem,
  freemem,
  EOL,
};

export default {
  platform,
  cpus,
  homedir,
  tmpdir,
  hostname,
  type,
  release,
  arch,
  totalmem,
  freemem,
  EOL,
};
