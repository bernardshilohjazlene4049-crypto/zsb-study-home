export function getAiStatus() {
  const base = readBase("zsb.ui.tutorApiBase");
  if (!base) {
    return {
      connected: false,
      message: "AI 未连接。需要在设置里填写服务端地址（环境变量名 TUTOR_API_BASE）。密钥不能写进网页或本仓库。"
    };
  }
  return {
    connected: false,
    message: "已填写地址，但本阶段没有发起辅导请求，也不会生成讲解。阶段 2 才会接入可核验的会话。"
  };
}

export function getOcrStatus() {
  const base = readBase("zsb.ui.ocrApiBase");
  if (!base) {
    return {
      connected: false,
      message: "识题未连接。需要服务端地址（环境变量名 OCR_API_BASE）。当前不会上传图片，也不会编造识别文字。"
    };
  }
  return {
    connected: false,
    message: "已填写地址，但本阶段不会上传图片，也不会显示识别结果。"
  };
}

export function getSyncStatus() {
  const base = readBase("zsb.ui.syncApiBase");
  if (!base) {
    return { connected: false, message: "未跨设备同步。现在只有本机保存和 JSON 导入导出。" };
  }
  return { connected: false, message: "已填写同步地址，但阶段 4 的账号与冲突合并还没有实现。不会显示已同步。" };
}

export function getLabsStatus() {
  return {
    connected: false,
    message: "代码运行服务未连接。不会显示伪造的 C 或 SQL Server 运行结果。网页实验沙箱留到阶段 3。"
  };
}

function readBase(key) {
  try {
    return localStorage.getItem(key)?.trim() || "";
  } catch {
    return "";
  }
}
