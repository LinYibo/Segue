const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getAiSettings: () => ipcRenderer.invoke("settings:get"),
  addAiProvider: (patch) => ipcRenderer.invoke("settings:add", patch),
  selectAiProvider: (id) => ipcRenderer.invoke("settings:select", id),
  removeAiProvider: (id) => ipcRenderer.invoke("settings:remove", id),
  chat: (body, onEvent) => {
    const listener = (_event, evt) => onEvent(evt);
    ipcRenderer.on("ai:chat:event", listener);
    return ipcRenderer.invoke("ai:chat", body).finally(() => {
      ipcRenderer.removeListener("ai:chat:event", listener);
    });
  },
  abortChat: () => ipcRenderer.send("ai:chat:abort"),
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
});
