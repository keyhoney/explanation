function Math(el)
  -- \displaystyle 추가
  if el.mathtype == "InlineMath" then
    el.text = "\\displaystyle " .. el.text
  end

  -- 수식 내부의 \, 모두 제거
  el.text = el.text:gsub("\\,", "")

  return el
end