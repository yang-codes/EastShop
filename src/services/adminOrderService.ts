import ExcelJS from 'exceljs'
import type { EntrySource, Order, OrderStatus } from '../types/order'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient'
import type { SupportedLanguage } from '../types/language'

export type OrderExportFormat = 'csv' | 'xlsx'

type OrderItemRow = {
  /** 商品 ID，用于追溯订单明细来自哪个商品。 */
  product_id: string
  /** 下单当时的商品名称快照，避免商品改名影响历史订单。 */
  product_name: string
  /** 用户下单时使用的商品名称语言。 */
  language: SupportedLanguage
  /** 下单当时的商品单价快照。 */
  price: number | string
  /** 购买数量。 */
  quantity: number
  /** 明细小计，业务上等于服务端确认的 price * quantity。 */
  subtotal: number | string
}

type OrderRow = {
  /** 订单唯一 ID，用于后台查询、客户沟通和导出。 */
  id: string
  /** 客户姓名。 */
  customer_name: string
  /** 客户联系电话。 */
  phone: string
  /** 客户社交账号，便于 Instagram/Telegram 人工联系。 */
  social_handle: string | null
  /** 客户确认后的详细收货地址。 */
  address: string
  /** 客户备注。 */
  note: string | null
  /** 浏览器定位纬度。 */
  latitude: number | null
  /** 浏览器定位经度。 */
  longitude: number | null
  /** 浏览器定位精度，单位米。 */
  location_accuracy: number | null
  /** Geoapify 反查国家。 */
  geo_country: string | null
  /** Geoapify 反查城市或地区。 */
  geo_city: string | null
  /** Geoapify 反查街道或地址片段。 */
  geo_street: string | null
  /** 订单来源，用于区分 Telegram、Instagram 和普通 Web 订单。 */
  source: EntrySource
  /** 订单总价，由服务端重新计算后写入。 */
  total: number | string
  /** 后台运营处理状态。 */
  status: OrderStatus
  /** 订单创建时间。 */
  created_at: string
  /** 订单商品明细，后台列表读取时嵌套加载。 */
  order_items?: OrderItemRow[]
}

const mockOrders: Order[] = [
  {
    contact: {
      address: 'Almaty, Dostyk Ave 85',
      name: 'Aruzhan',
      note: 'Need delivery quote before confirmation.',
      phone: '+7 701 000 1020',
      socialHandle: '@aruzhan_shop',
    },
    createdAt: '2026-05-29T10:30:00.000Z',
    id: 'ORD-20260529-001',
    items: [
      {
        language: 'en',
        productId: 'esd-floor-tile-600',
        productName: 'PVC ESD Floor Tile 600x600',
        quantity: 48,
        subtotal: 614.4,
        unitPrice: 12.8,
      },
    ],
    location: {
      accuracy: 38,
      city: 'Almaty',
      country: 'Kazakhstan',
      latitude: 43.238949,
      longitude: 76.889709,
      street: 'Dostyk Ave',
    },
    source: 'telegram',
    status: 'new',
    total: 614.4,
  },
  {
    contact: {
      address: 'Bishkek warehouse district',
      name: 'Timur',
      phone: '+996 555 234 678',
      socialHandle: '@timur_tools',
    },
    createdAt: '2026-05-28T15:45:00.000Z',
    id: 'ORD-20260528-002',
    items: [
      {
        language: 'en',
        productId: 'led-work-light-50w',
        productName: '50W Portable LED Work Light',
        quantity: 12,
        subtotal: 288,
        unitPrice: 24,
      },
      {
        language: 'en',
        productId: 'laser-distance-meter',
        productName: 'Handheld Laser Distance Meter 60m',
        quantity: 3,
        subtotal: 93,
        unitPrice: 31,
      },
    ],
    source: 'instagram',
    status: 'contacted',
    total: 381,
  },
  {
    contact: {
      address: 'Tashkent, Yunusabad',
      name: 'Dilshod',
      note: 'Monthly replenishment order.',
      phone: '+998 90 123 4567',
    },
    createdAt: '2026-05-27T08:15:00.000Z',
    id: 'ORD-20260527-003',
    items: [
      {
        language: 'en',
        productId: 'stackable-storage-bin',
        productName: 'Stackable Parts Storage Bin',
        quantity: 120,
        subtotal: 384,
        unitPrice: 3.2,
      },
    ],
    source: 'web',
    status: 'fulfilled',
    total: 384,
  },
]

/**
 * 将 Supabase 订单行转换为前端 Order 业务模型。
 * 业务用途：给订单后台提供稳定的数据结构，用于展示、筛选、导出和状态更新。
 *
 * @param row `orders` 表返回的原始行，可包含嵌套的 `order_items`。
 * @returns 后台订单页面使用的订单对象。
 */
function mapOrder(row: OrderRow): Order {
  return {
    contact: {
      address: row.address,
      name: row.customer_name,
      note: row.note ?? undefined,
      phone: row.phone,
      socialHandle: row.social_handle ?? undefined,
    },
    createdAt: row.created_at,
    id: row.id,
    items: (row.order_items ?? []).map((item) => ({
      language: item.language,
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      subtotal: Number(item.subtotal),
      unitPrice: Number(item.price),
    })),
    location: {
      accuracy: row.location_accuracy ?? undefined,
      city: row.geo_city ?? undefined,
      country: row.geo_country ?? undefined,
      latitude: row.latitude ?? undefined,
      longitude: row.longitude ?? undefined,
      street: row.geo_street ?? undefined,
    },
    source: row.source,
    status: row.status,
    total: Number(row.total),
  }
}

export const adminOrderService = {
  /**
   * 读取后台订单列表。
   * 业务用途：运营人员查看新订单、联系客户、核对地址、处理状态并导出订单。
   * 未配置 Supabase 时返回稳定的 mock 订单，保证后台 UI 可在开发环境预览。
   *
   * @returns Supabase 模式下按创建时间倒序排列的订单列表。
   */
  async listOrders(): Promise<Order[]> {
    if (!isSupabaseConfigured()) {
      return mockOrders
    }

    const { data, error } = await getSupabaseClient()
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return (data as OrderRow[]).map(mapOrder)
  },

  /**
   * 更新订单处理状态。
   * 业务用途：跟踪订单从新订单到已联系、已完成或已取消的运营流程。
   * mock 模式由页面本地状态处理；Supabase 模式写入 `orders.status`。
   *
   * @param orderId 要更新的订单 ID。
   * @param status 新的运营处理状态。
   */
  async updateOrderStatus(orderId: string, status: OrderStatus) {
    if (!isSupabaseConfigured()) {
      return
    }

    const { error } = await getSupabaseClient().from('orders').update({ status }).eq('id', orderId)

    if (error) {
      throw error
    }
  },

  /**
   * 将订单数据转换为可下载的 CSV 或 XLSX。
   * 业务用途：运营人员导出订单，用于线下履约、财务核对或人工报表。
   * 调用方负责创建浏览器 Blob 并触发下载。
   *
   * @param orders 后台当前筛选后的订单列表。
   * @param format 导出文件格式。
   * @returns 带 BOM 的 CSV 字符串，或 XLSX 二进制缓冲区。
   */
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
