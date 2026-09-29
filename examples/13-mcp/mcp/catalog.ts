import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const prices = new Map([
  ['NOTEBOOK', 12],
  ['PENCIL', 3],
]);

const server = new McpServer({ name: 'product-catalog', version: '1.0.0' });

server.registerTool(
  'get_product_price',
  {
    title: '查询商品单价',
    description: '只读查询本地商品目录，返回人民币单价（元）。SKU 区分大小写。',
    inputSchema: { sku: z.string().min(1).describe('商品编号：NOTEBOOK 或 PENCIL') },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ sku }) => {
    const unitPrice = prices.get(sku);
    if (unitPrice === undefined) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown SKU: ${sku}. Supported SKUs: NOTEBOOK, PENCIL.` }],
      };
    }
    const product = { sku, unitPrice, currency: 'CNY' };
    return { content: [{ type: 'text', text: JSON.stringify(product) }], structuredContent: product };
  },
);

// stdout belongs to the MCP transport; diagnostics, if added, must use stderr.
await server.connect(new StdioServerTransport());
