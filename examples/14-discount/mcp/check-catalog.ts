import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({ name: 'catalog-check', version: '1.0.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [fileURLToPath(new URL('./catalog.ts', import.meta.url))],
});

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name), ['get_product_price']);
  assert.equal(tools[0].annotations?.readOnlyHint, true);

  for (const [sku, unitPrice] of [['NOTEBOOK', 12], ['PENCIL', 3]] as const) {
    const result = await client.callTool({ name: 'get_product_price', arguments: { sku } });
    assert.notEqual(result.isError, true);
    assert.deepEqual(result.structuredContent, { sku, unitPrice, currency: 'CNY' });
    assert.deepEqual(result.content, [{ type: 'text', text: JSON.stringify({ sku, unitPrice, currency: 'CNY' }) }]);
  }

  const unknown = await client.callTool({ name: 'get_product_price', arguments: { sku: 'UNKNOWN' } });
  assert.equal(unknown.isError, true);
  assert.deepEqual(unknown.content, [{ type: 'text', text: 'Unknown SKU: UNKNOWN. Supported SKUs: NOTEBOOK, PENCIL.' }]);
  const invalid = await client.callTool({ name: 'get_product_price', arguments: { sku: 123 } });
  assert.equal(invalid.isError, true);

  console.log('MCP verified: tools/list; NOTEBOOK=12 CNY; PENCIL=3 CNY; unknown SKU and invalid input rejected.');
} finally {
  await client.close();
}
