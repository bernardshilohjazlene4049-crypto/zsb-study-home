export function getAiStatus() {
  const base = readBase("zsb.ui.tutorApiBase");
  if (!base) {
    return {
      connected: false,
      message: "即将开放"
    };
  }
  return {
    connected: false,
    message: "即将开放"
  };
}

export function getOcrStatus() {
  const base = readBase("zsb.ui.ocrApiBase");
  if (!base) {
    return {
      connected: false,
      message: "即将开放"
    };
  }
  return {
    connected: false,
    message: "即将开放"
  };
}

export function getSyncStatus() {
  const base = readBase("zsb.ui.syncApiBase");
  if (!base) {
    return { connected: false, message: "即将开放" };
  }
  return { connected: false, message: "即将开放" };
}

export function getLabsStatus() {
  return {
    connected: false,
    message: "即将开放"
  };
}

function readBase(key) {
  try {
    return localStorage.getItem(key)?.trim() || "";
  } catch {
    return "";
  }
}
