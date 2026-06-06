import { getSupabaseClient } from '../lib/supabaseClient'

export type NotificationSettings = {
  feishuEnabled: boolean
  feishuSecret: string
  feishuWebhook: string
}

type NotificationSettingsRow = {
  feishu_enabled: boolean
  id: string
}

const defaultSettings: NotificationSettings = {
  feishuEnabled: false,
  feishuSecret: '',
  feishuWebhook: '',
}

function mapSettings(row: NotificationSettingsRow | null): NotificationSettings {
  if (!row) {
    return defaultSettings
  }

  return {
    feishuEnabled: row.feishu_enabled,
    feishuSecret: '',
    feishuWebhook: '',
  }
}

async function hmacSha256Base64(keyText: string, text: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(keyText), { hash: 'SHA-256', name: 'HMAC' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(text))

  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

async function buildFeishuPayload(text: string, secret: string) {
  const payload: Record<string, unknown> = {
    content: {
      text,
    },
    msg_type: 'text',
  }

  if (secret.trim()) {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    payload.timestamp = timestamp
    payload.sign = await hmacSha256Base64(`${timestamp}\n${secret.trim()}`, '')
  }

  return payload
}

export const adminNotificationService = {
  async getSettings(): Promise<NotificationSettings> {
    const { data, error } = await getSupabaseClient()
      .from('notification_settings')
      .select('id, feishu_enabled')
      .eq('id', 'default')
      .maybeSingle()

    if (error) {
      throw error
    }

    return mapSettings(data as NotificationSettingsRow | null)
  },

  async saveSettings(settings: NotificationSettings): Promise<NotificationSettings> {
    const payload: Record<string, unknown> = {
      feishu_enabled: settings.feishuEnabled,
      id: 'default',
    }
    const nextWebhook = settings.feishuWebhook.trim()
    const nextSecret = settings.feishuSecret.trim()

    if (nextWebhook) {
      payload.feishu_webhook = nextWebhook
    }

    if (nextSecret) {
      payload.feishu_secret = nextSecret
    }

    const { data, error } = await getSupabaseClient()
      .from('notification_settings')
      .upsert(payload)
      .select('id, feishu_enabled')
      .single()

    if (error) {
      throw error
    }

    return mapSettings(data as NotificationSettingsRow)
  },

  async sendTest(settings: NotificationSettings) {
    const webhook = settings.feishuWebhook.trim()

    if (!webhook) {
      throw new Error('请先填写飞书机器人 webhook。')
    }

    const payload = await buildFeishuPayload(`EastShop 飞书通知测试\n时间：${new Date().toLocaleString()}`, settings.feishuSecret)
    const response = await fetch(webhook, {
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })
    const responseText = await response.text()

    if (!response.ok) {
      throw new Error(`飞书测试发送失败：HTTP ${response.status} ${responseText}`)
    }

    try {
      const result = JSON.parse(responseText) as { code?: number; msg?: string }

      if (typeof result.code === 'number' && result.code !== 0) {
        throw new Error(`飞书测试发送失败：${result.code} ${result.msg ?? ''}`.trim())
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        return
      }

      throw error
    }
  },
}
