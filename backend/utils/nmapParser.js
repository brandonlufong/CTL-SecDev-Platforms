// utils/nmapParser.js
const xml2js = require('xml2js');

const parseNmapXml = async (xml) => {
  const result = await xml2js.parseStringPromise(xml);
  const ports = result?.nmaprun?.host?.[0]?.ports?.[0]?.port || [];

  return ports.map(p => ({
    port: +p.$.portid,
    state: p.state?.[0]?.$.state,
    service: p.service?.[0]?.$.name,
  }));
};

module.exports = { parseNmapXml };
