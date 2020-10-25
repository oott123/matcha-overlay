import axios from 'axios'
import { debounce } from 'debounce'
import { Cache } from '../cache'

export interface ItemInfo {
  ID: number
  Icon: string
  LevelItem: number
  IsAdvancedMeldingPermitted: number
  MateriaSlotCount: number
  Name_chs: string
}

export interface ItemRecord {
  /**
   * Name
   */
  n: string
  /**
   * Icon
   */
  i: string
  /**
   * MateriaSlotCount
   */
  s: number
  /**
   * IsAdvancedMeldingPermitted
   */
  a: number
  /**
   * LevelItem
   */
  l: number
}

export interface XivapiPagedResponse<T> {
  Pagination: {
    Page: number
    PageNext: number
    PagePrev: number
    PageTotal: number
    Results: number
    ResultsPerPage: number
    ResultsTotal: number
  }
  Results: T[]
}

export const xivapiRoot = 'https://cafemaker.wakingsands.com'
const itemCache = new Cache<number, ItemRecord>('gearset-item')
const queryColumns: Array<keyof ItemInfo> = [
  'ID',
  'Icon',
  'LevelItem',
  'MateriaSlotCount',
  'IsAdvancedMeldingPermitted',
  'Name_chs',
]

let itemQueryList: Array<{
  id: number
  resolve: (record?: ItemRecord | PromiseLike<ItemRecord>) => any
  reject: (e: Error) => any
}> = []

const doQuery = debounce(function () {
  const list = itemQueryList.slice()
  itemQueryList = []

  const ids = Array.from(new Set(list.map(({ id }) => id))).join(',')

  axios
    .get<XivapiPagedResponse<ItemInfo>>(
      `${xivapiRoot}/item?columns=${encodeURIComponent(queryColumns.join(','))}&ids=${encodeURIComponent(ids)}`,
    )
    .then((res) => {
      for (const result of res.data.Results) {
        const record = {
          n: result.Name_chs,
          i: result.Icon,
          s: result.MateriaSlotCount,
          a: result.IsAdvancedMeldingPermitted,
          l: result.LevelItem,
        }

        itemCache.set(result.ID, record)
        for (let i = 0; i < list.length; ) {
          if (list[i].id !== result.ID) {
            ++i
            continue
          }

          list[i].resolve(record)
          list.splice(i, 1)
        }
      }

      list.forEach((item) => item.resolve())
    })
    .catch((e) => {
      list.forEach((item) => item.reject(e))
    })
}, 200)

export function queryItem(id: number): Promise<ItemRecord> {
  const fromCache = itemCache.get(id)
  if (fromCache && typeof fromCache.l === 'number') {
    return Promise.resolve(fromCache)
  }

  return new Promise((resolve, reject) => {
    itemQueryList.push({ id, resolve, reject })
    doQuery()
  })
}