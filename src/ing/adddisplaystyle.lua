function Math(el)
    if el.mathtype == "InlineMath" then
      el.text = "\\displaystyle " .. el.text
    end
    return el
  end