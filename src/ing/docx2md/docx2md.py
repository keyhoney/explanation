#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pandoc DOCX → Markdown GUI Converter
------------------------------------
- 선택한 .docx 파일들을 같은 이름의 .md로 일괄 변환합니다.
- 기본값: --mathjax 사용, Lua 필터는 선택 사항.
- 출력 폴더를 지정하지 않으면 각 파일과 같은 폴더에 저장합니다.
- Pandoc이 설치되어 있어야 합니다: https://pandoc.org

파이썬 3.8+ 권장. Windows/macOS/Linux에서 동작합니다.
"""

import os
import sys
import threading
import subprocess
from pathlib import Path
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

APP_TITLE = "Pandoc DOCX → Markdown 변환기"
DEFAULT_ARGS = ["--mathjax"]  # 기본으로 켜둘 옵션

def is_pandoc_available() -> bool:
    try:
        # On success returns 0 and prints version
        subprocess.run(["pandoc", "-v"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        return True
    except Exception:
        return False

class PandocGUI(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(APP_TITLE)
        self.geometry("760x540")
        self.minsize(700, 480)

        self.selected_files = []  # list[Path]
        self.output_dir = tk.StringVar(value="")  # empty = same as input file
        self.use_mathjax = tk.BooleanVar(value=True)
        self.lua_filter = tk.StringVar(value="")  # path to lua filter (optional)
        self.extra_args = tk.StringVar(value="")  # freeform extra args

        self._build_ui()

        if not is_pandoc_available():
            messagebox.showwarning(
                "Pandoc 미설치 감지",
                "시스템에서 pandoc을 찾지 못했습니다.\n\n"
                "설치 후 다시 실행해 주세요.\nhttps://pandoc.org/installing.html"
            )

    # ---------- UI ----------
    def _build_ui(self):
        pad = {"padx": 10, "pady": 8}

        frm_top = ttk.LabelFrame(self, text="입력 파일")
        frm_top.pack(fill="x", **pad)

        btn_sel = ttk.Button(frm_top, text="DOCX 파일 선택 (여러 개)", command=self.select_files)
        btn_sel.pack(side="left", padx=8, pady=8)

        btn_clear = ttk.Button(frm_top, text="목록 비우기", command=self.clear_files)
        btn_clear.pack(side="left", padx=4)

        self.file_list = tk.Listbox(frm_top, height=6, selectmode=tk.EXTENDED)
        self.file_list.pack(fill="both", expand=True, padx=8, pady=(8,10))

        # Options
        frm_opts = ttk.LabelFrame(self, text="옵션")
        frm_opts.pack(fill="x", **pad)

        ttk.Checkbutton(frm_opts, text="--mathjax 사용", variable=self.use_mathjax).grid(row=0, column=0, sticky="w", padx=8, pady=6)

        ttk.Label(frm_opts, text="Lua 필터 경로 (선택):").grid(row=1, column=0, sticky="w", padx=8)
        ent_lua = ttk.Entry(frm_opts, textvariable=self.lua_filter, width=60)
        ent_lua.grid(row=1, column=1, sticky="we", padx=8, pady=4)
        ttk.Button(frm_opts, text="찾아보기", command=self.browse_lua).grid(row=1, column=2, padx=8)

        ttk.Label(frm_opts, text="추가 Pandoc 인자 (선택):").grid(row=2, column=0, sticky="w", padx=8)
        ent_extra = ttk.Entry(frm_opts, textvariable=self.extra_args, width=60)
        ent_extra.grid(row=2, column=1, sticky="we", padx=8, pady=4)
        ent_extra_tip = ttk.Label(frm_opts, text='예) --from=docx --to=markdown_strict', foreground="#666")
        ent_extra_tip.grid(row=3, column=1, sticky="w", padx=8, pady=(0,6))

        frm_opts.columnconfigure(1, weight=1)

        # Output
        frm_out = ttk.LabelFrame(self, text="출력")
        frm_out.pack(fill="x", **pad)

        ttk.Label(frm_out, text="출력 폴더 (선택):").grid(row=0, column=0, sticky="w", padx=8)
        ent_outdir = ttk.Entry(frm_out, textvariable=self.output_dir, width=60)
        ent_outdir.grid(row=0, column=1, sticky="we", padx=8, pady=6)
        ttk.Button(frm_out, text="폴더 선택", command=self.choose_output_dir).grid(row=0, column=2, padx=8)

        frm_out.columnconfigure(1, weight=1)

        # Actions
        frm_act = ttk.Frame(self)
        frm_act.pack(fill="x", **pad)

        self.btn_convert = ttk.Button(frm_act, text="변환 시작", command=self.start_convert)
        self.btn_convert.pack(side="left", padx=8)

        self.btn_open_out = ttk.Button(frm_act, text="출력 폴더 열기", command=self.open_output_dir, state="disabled")
        self.btn_open_out.pack(side="left")

        # Progress + log
        frm_prog = ttk.LabelFrame(self, text="진행 상태 / 로그")
        frm_prog.pack(fill="both", expand=True, **pad)

        self.progress = ttk.Progressbar(frm_prog, mode="determinate")
        self.progress.pack(fill="x", padx=10, pady=(10, 0))

        self.txt_log = tk.Text(frm_prog, height=12)
        self.txt_log.pack(fill="both", expand=True, padx=10, pady=10)

        # Footer
        footer = ttk.Label(self, text="각 .docx는 같은 이름의 .md로 저장됩니다. (예: 20240621.docx → 20240621.md)")
        footer.pack(fill="x", padx=12, pady=(0,12))

    # ---------- Handlers ----------
    def select_files(self):
        paths = filedialog.askopenfilenames(
            title="DOCX 파일 선택",
            filetypes=[("Word DOCX", "*.docx")],
        )
        if paths:
            for p in paths:
                if p not in self.selected_files:
                    self.selected_files.append(p)
                    self.file_list.insert(tk.END, p)

    def clear_files(self):
        self.selected_files = []
        self.file_list.delete(0, tk.END)

    def browse_lua(self):
        path = filedialog.askopenfilename(
            title="Lua 필터 선택",
            filetypes=[("Lua files", "*.lua"), ("All files", "*.*")],
        )
        if path:
            self.lua_filter.set(path)

    def choose_output_dir(self):
        path = filedialog.askdirectory(title="출력 폴더 선택")
        if path:
            self.output_dir.set(path)

    def open_output_dir(self):
        # Try to open the output folder (if set), else the first file's folder
        target = self.output_dir.get().strip()
        if not target:
            if self.selected_files:
                target = str(Path(self.selected_files[0]).parent)
        if not target:
            return
        if sys.platform.startswith("win"):
            os.startfile(target)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", target])
        else:
            subprocess.Popen(["xdg-open", target])

    def start_convert(self):
        if not self.selected_files:
            messagebox.showinfo("알림", "먼저 DOCX 파일을 선택해 주세요.")
            return
        if not is_pandoc_available():
            messagebox.showerror("오류", "pandoc을 찾을 수 없습니다. 설치 후 다시 시도하세요.")
            return

        # Disable buttons while running
        self.btn_convert.config(state="disabled")
        self.btn_open_out.config(state="disabled")
        self.log_clear()
        self.progress["value"] = 0
        self.progress["maximum"] = len(self.selected_files)

        t = threading.Thread(target=self._convert_worker, daemon=True)
        t.start()

    def _convert_worker(self):
        success = 0
        for idx, in_path_str in enumerate(self.selected_files, start=1):
            in_path = Path(in_path_str)
            try:
                out_dir = Path(self.output_dir.get().strip()) if self.output_dir.get().strip() else in_path.parent
                out_dir.mkdir(parents=True, exist_ok=True)
                out_path = out_dir / (in_path.stem + ".md")

                cmd = ["pandoc", str(in_path), "-t", "markdown", "-o", str(out_path)]
                if self.use_mathjax.get():
                    cmd.append("--mathjax")
                lua = self.lua_filter.get().strip()
                if lua:
                    cmd.extend(["--lua-filter", lua])

                extra = self.extra_args.get().strip()
                if extra:
                    # naive split on spaces; advanced users can quote as needed
                    cmd.extend(extra.split())

                self.log(f"[{idx}/{len(self.selected_files)}] 변환 중: {in_path.name}")
                result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

                if result.returncode == 0:
                    self.log(f"  ✔ 완료: {out_path}")
                    success += 1
                else:
                    self.log(f"  ✖ 실패: {in_path.name}\n    stderr: {result.stderr.strip()}")

            except Exception as e:
                self.log(f"  ✖ 오류: {in_path.name}\n    {e}")

            # update progress
            self.progress.step(1)
            self.update_idletasks()

        self.log(f"\n완료: {success}/{len(self.selected_files)} 파일 변환")
        # Re-enable buttons
        self.btn_convert.config(state="normal")
        self.btn_open_out.config(state="normal")

    # ---------- Logging ----------
    def log(self, msg: str):
        self.txt_log.insert(tk.END, str(msg) + "\n")
        self.txt_log.see(tk.END)

    def log_clear(self):
        self.txt_log.delete("1.0", tk.END)

def main():
    app = PandocGUI()
    app.mainloop()

if __name__ == "__main__":
    main()
