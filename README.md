# NixieClock 辉光时钟

赛博朋克风格的桌面时钟，单文件便携运行（约 2.4 MB，无需安装）。

- 三种显示模式：辉光管 / 翻页时钟 / 赛博朋克（数字雨 + CRT 扫描线），共用一套七段数码渲染
- 无边框真全屏、窗口置顶切换
- 系统托盘：版本信息 / 随电脑启动 / 检查更新 / 重新启动 / 退出
- 跨显示器移动：配合桌面快捷键脚本（见下文）

## 下载使用

从 [Releases](https://github.com/listlonely/NixieClock/releases) 下载 `NixieClock.exe`，双击即用。

启动即为无边框全屏；点窗口下方控制条的「全屏」可切换铺满 / 恢复。

## 已知限制：Windows Smart App Control（SAC）

本程序目前**未做代码签名**。Windows 11 22H2+ 全新安装的机器若开启了智能应用控制（Smart App Control），会按文件哈希拦截新的未签名 exe，且 SAC 没有白名单机制。

- 存量 Windows 10、升级安装的 Windows 11 等无 SAC 的环境不受影响，可正常使用
- SAC 用户暂时无法运行，需等后续接入代码签名（如 Azure Trusted Signing）后再发布

## 小窗启动（推荐）

直接双击 exe 会以上次关闭时的状态启动（可能为全屏）。若希望以小窗打开，可创建快捷方式并附加参数：

```powershell
NixieClock.exe --window-use-saved-state=false --window-maximize=false
```

说明：Neutralino 会记忆上次窗口状态（useSavedState），该记忆优先于配置文件；上述参数禁用记忆并强制非最大化，启动为 1100x640 居中小窗。

## 跨屏移动

方式一（无需任何脚本）：点一下时钟让窗口获得焦点，按 `Win + Shift + ←/→`。

方式二（一键脚本）：仓库内的 `switch-screen.ps1` 可将时钟移到下一块显示器并铺满。为其创建桌面快捷方式，在「属性 → 快捷键」中绑定（如 `Ctrl+Alt+M`）即可全局热键切换。

## 从源码构建

需要 Node.js：

```powershell
npx -y @neutralinojs/neu@latest build --release --embed-resources --clean
```

产物位于 `dist/NixieClock/NixieClock-win_x64.exe`。

## License

MIT
