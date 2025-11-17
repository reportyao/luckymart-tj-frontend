import { supabase } from './supabase'

/**
 * 上传图片到Supabase Storage
 * @param file 图片文件
 * @param bucket 存储桶名称
 * @param folder 文件夹路径 (可选)
 * @returns 图片的公开URL
 */
export async function uploadImage(
  file: File,
  bucket: string = 'payment-proofs',
  folder?: string
): Promise<string> {
  try {
    // 生成唯一文件名
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = folder ? `${folder}/${fileName}` : fileName

    // 上传文件
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      throw error
    }

    // 获取公开URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)

    return publicUrl
  } catch (error) {
    console.error('图片上传失败:', error)
    throw new Error('图片上传失败')
  }
}

/**
 * 上传多张图片
 * @param files 图片文件数组
 * @param bucket 存储桶名称
 * @param folder 文件夹路径 (可选)
 * @returns 图片URL数组
 */
export async function uploadImages(
  files: File[],
  bucket: string = 'payment-proofs',
  folder?: string
): Promise<string[]> {
  const uploadPromises = files.map(file => uploadImage(file, bucket, folder))
  return Promise.all(uploadPromises)
}

/**
 * 删除图片
 * @param url 图片URL
 * @param bucket 存储桶名称
 */
export async function deleteImage(url: string, bucket: string = 'payment-proofs'): Promise<void> {
  try {
    // 从URL提取文件路径
    const urlParts = url.split('/')
    const filePath = urlParts.slice(urlParts.indexOf(bucket) + 1).join('/')

    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath])

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('图片删除失败:', error)
    throw new Error('图片删除失败')
  }
}
