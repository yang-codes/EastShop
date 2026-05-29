import ExcelJS from 'exceljs'
import type { Order } from '../types/order'

export type OrderExportFormat = 'csv' | 'xlsx'

export const adminOrderService = {
  async listOrders(): Promise<Order[]> {
    return []
  },

  async exportOrders(orders: Order[], format: OrderExportFormat) {
    const rows = orders.flatMap((order) =>
      order.items.map((item) => ({
        address: order.contact.address,
        createdAt: order.createdAt,
        customerName: order.contact.name,
        itemName: item.productName,
        orderId: order.id,
        phone: order.contact.phone,
        quantity: item.quantity,
        source: order.source,
        status: order.status,
        subtotal: item.subtotal,
        total: order.total,
      })),
    )

    if (format === 'csv') {
      const headers = Object.keys(rows[0] ?? { orderId: '' })
      const body = rows.map((row) =>
        headers
          .map((header) => {
            const value = row[header as keyof typeof row] ?? ''
            return `"${String(value).replaceAll('"', '""')}"`
          })
          .join(','),
      )

      return `\uFEFF${[headers.join(','), ...body].join('\n')}`
    }

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Orders')
    worksheet.columns = Object.keys(rows[0] ?? { orderId: '' }).map((key) => ({
      header: key,
      key,
      width: 18,
    }))
    worksheet.addRows(rows)

    const buffer = await workbook.xlsx.writeBuffer()
    return buffer as ArrayBuffer
  },
}
