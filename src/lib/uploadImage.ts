import { supabase } from './supabase'
import imageCompression from 'browser-image-compression'

/**
 * 上传图片到Supabase Storage
 * @param file 图片文件
 * @param bucket 存储桶名称
 * @param folder 文件夹路径 (可选)
 * @returns 图片的公开URL
 */
export async function uploadImage(
  file: File,
  compress: boolean = true,
  bucket: string = 'payment-proofs',
  folder?: string
): Promise<string> {
  try {
    let fileToUpload = file
    let contentType = file.type
    let fileExt = file.name.split('.').pop()
    let fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

    if (compress && file.type.startsWith('image/')) {
      // 1. 压缩和 WebP 转换
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 1, // 最大文件大小 1MB
        maxWidthOrHeight: 1920, // 最大分辨率 1920px
        useWebWorker: true,
        fileType: 'image/webp', // 转换为 WebP 格式
      })

      fileToUpload = compressedFile
      contentType = 'image/webp'
      fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.webp`
    }

    // 生成唯一文件名
    const filePath = folder ? `${folder}/${fileName}` : fileName

    // 上传文件
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileToUpload, {
        cacheControl: '3600',
        upsert: false,
        contentType: contentType,
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
  compress: boolean = true,
  bucket: string = 'payment-proofs',
  folder?: string
): Promise<string[]> {
  const uploadPromises = files.map(file => uploadImage(file, compress, bucket, folder))
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
