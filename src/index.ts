import { Request, Response } from "express";
import initCore, { sfsConfig, UploadedFile } from "sfs-node";

export default function initFunctions({
  publicFolder,
  mask,
  getFileById,
  getFileByHash,
  createFile,
  logger,
  allowDuplicates,
}: sfsConfig) {
  const {
    resolveFilePath,
    idToUrl,
    urlToId,
    saveFile,
    deleteFileByHash,
    deleteFileById,
    getDiskUsage,
  } = initCore({
    publicFolder,
    mask,
    getFileById,
    getFileByHash,
    createFile,
    logger,
    allowDuplicates,
  });

  const optimisticUrls = new Set();

  const getFile = async (req: Request, res: Response) => {
    const fullUrl = req.protocol + "://" + req.get("host") + req.originalUrl;
    if (optimisticUrls.has(fullUrl)) {
      return res.status(425);
    }
    const fileId = urlToId(fullUrl);
    try {
      const { filePath, fileName } = await resolveFilePath(fileId);
      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
      return res.status(200).sendFile(filePath);
    } catch (err) {
      return res.status(404).send();
    }
  };

  const prepareOptimisticUpload = async (req, res) => {
    const id = req.body.id;
    const optimisticUrl = urlToId(id);
    try {
      optimisticUrls.add(optimisticUrl);
      return res.status(200).send(optimisticUrl);
    } catch (err) {
      console.error(err);
      return res.status(500).send();
    }
  };

  const uploadFile = async (
    req,
    res: Response,
    options: {
      pathParamKey: string;
      fileParamKey: string;
      optimisticIdKey: string;
    } = {
      pathParamKey: "path",
      fileParamKey: "file",
      optimisticIdKey: "id",
    }
  ) => {
    if (!req.files) {
      return res.status(400).send("Request doesn't contain any files");
    }
    const { pathParamKey, fileParamKey, optimisticIdKey } = options;
    const file = req.files[fileParamKey];
    const path = req.body[pathParamKey];
    const id = req.body[optimisticIdKey];
    let optimisticUrl;
    try {
      if (id) {
        optimisticUrl = idToUrl(id);
      }
      const fileInfo = await saveFile(file, path, id);
      if (fileInfo && optimisticUrl) {
        optimisticUrls.delete(optimisticUrl); // Delete the URL, not the id
      }
      return res.status(200).send(fileInfo);
    } catch (err) {
      console.error(err);
      if (optimisticUrl) {
        optimisticUrls.delete(optimisticUrl); // Delete the URL, not the id
      }
      return res.status(500).send();
    }
  };

  const uploadFiles = async (
    req,
    res: Response,
    options: { pathParamKey: string } = {
      pathParamKey: "path",
    }
  ) => {
    if (!req.files) {
      return res.status(400).send("Request doesn't contain any files");
    }
    const { pathParamKey } = options;

    try {
      const path = req.body[pathParamKey];
      const files = req.files;
      const allFiles: UploadedFile[] = [];

      Object.values(files).forEach((file) => {
        if (Array.isArray(file)) {
          allFiles.push(...file);
        } else {
          // @ts-ignore
          allFiles.push(file);
        }
      });

      const fileInfo = await Promise.all(
        allFiles.map((file) => saveFile(file, path))
      );
      return res.status(200).send(fileInfo);
    } catch (err) {
      console.error(err);
      return res.status(500).send();
    }
  };

  const deleteFile = async (req, res) => {
    try {
      const fullUrl = req.protocol + "://" + req.get("host") + req.originalUrl;
      const fileId = urlToId(fullUrl);
      await deleteFileById(fileId);
      return res.status(200).send("ok");
    } catch (err) {
      console.error(err);
      return res.status(500).send();
    }
  };

  return {
    getFile,
    idToUrl,
    urlToId,
    saveFile,
    prepareOptimisticUpload,
    deleteFileByHash,
    deleteFileById,
    deleteFile,
    getDiskUsage,
    uploadFile,
    uploadFiles,
  };
}
