interface SimulatorResult {
  output: string
  expectedOutput: string
  isCorrect: boolean
  feedback: string
}

type VarValue = string | number | number[]

export function simulateJava(
  code: string,
  expectedOutput?: string,
): SimulatorResult {
  const lines = code.split("\n").map((l) => l.trim())
  const vars = new Map<string, VarValue>()
  const outputLines: string[] = []

  try {
    executeBlock(lines, vars, outputLines)
  } catch {
    // silently handle parse failures
  }

  const output = outputLines.join("\n")
  const expected = (expectedOutput || "").trim()
  const isCorrect = expected
    ? output.trim() === expected
    : outputLines.length > 0

  return {
    output,
    expectedOutput: expected,
    isCorrect,
    feedback: isCorrect
      ? "Correct! Great job!"
      : expected
        ? "Not quite. Check your output against the expected result."
        : "Run your code to see the output.",
  }
}

function executeBlock(
  lines: string[],
  vars: Map<string, VarValue>,
  out: string[],
) {
  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Skip empty, braces, comments, class/method declarations
    if (
      !line ||
      line === "{" ||
      line === "}" ||
      line.startsWith("//") ||
      line.startsWith("public class") ||
      line.startsWith("public static void main")
    ) {
      i++
      continue
    }

    // Variable declarations
    const varMatch = line.match(
      /^(?:int|double|float|long|String|boolean)\s+(\w+)\s*=\s*(.+?)\s*;$/,
    )
    if (varMatch) {
      const [, name, expr] = varMatch
      vars.set(name, evaluateExpr(expr, vars))
      i++
      continue
    }

    // Array declarations
    const arrMatch = line.match(
      /^(?:int|double|float|long)\[\]\s+(\w+)\s*=\s*\{(.+?)\}\s*;$/,
    )
    if (arrMatch) {
      const [, name, elements] = arrMatch
      const arr = elements.split(",").map((e) => parseFloat(e.trim()))
      vars.set(name, arr)
      i++
      continue
    }

    // Variable reassignment
    const reassignMatch = line.match(/^(\w+)\s*=\s*(.+?)\s*;$/)
    if (reassignMatch && vars.has(reassignMatch[1])) {
      const [, name, expr] = reassignMatch
      vars.set(name, evaluateExpr(expr, vars))
      i++
      continue
    }

    // Compound assignment (+=, -=, *=, /=)
    const compoundMatch = line.match(/^(\w+)\s*([+\-*/])=\s*(.+?)\s*;$/)
    if (compoundMatch && vars.has(compoundMatch[1])) {
      const [, name, op, expr] = compoundMatch
      const current = toNumber(vars.get(name)!)
      const val = toNumber(evaluateExpr(expr, vars))
      const result =
        op === "+"
          ? current + val
          : op === "-"
            ? current - val
            : op === "*"
              ? current * val
              : current / val
      vars.set(name, result)
      i++
      continue
    }

    // System.out.println
    const printMatch = line.match(/^System\.out\.println\((.+)\)\s*;$/)
    if (printMatch) {
      const result = evaluateExpr(printMatch[1], vars)
      out.push(formatValue(result))
      i++
      continue
    }

    // For loop
    const forMatch = line.match(
      /^for\s*\(\s*int\s+(\w+)\s*=\s*(\d+)\s*;\s*\w+\s*([<>=!]+)\s*(.+?)\s*;\s*\w+(\+\+|--)\s*\)\s*\{?\s*$/,
    )
    if (forMatch) {
      const [, varName, startStr, cmp, endExpr, incr] = forMatch
      const start = parseInt(startStr)
      const end = toNumber(evaluateExpr(endExpr, vars))

      // Collect body lines until matching brace
      const bodyLines: string[] = []
      let braceCount = line.includes("{") ? 1 : 0
      i++
      if (braceCount === 0 && i < lines.length && lines[i] === "{") {
        braceCount = 1
        i++
      }
      while (i < lines.length && braceCount > 0) {
        if (lines[i].includes("{")) braceCount++
        if (lines[i].includes("}")) braceCount--
        if (braceCount > 0) bodyLines.push(lines[i])
        i++
      }

      // Execute loop (cap at 1000 iterations)
      let iter = start
      const check = (v: number) => {
        if (cmp === "<") return v < end
        if (cmp === "<=") return v <= end
        if (cmp === ">") return v > end
        if (cmp === ">=") return v >= end
        return false
      }
      let count = 0
      while (check(iter) && count < 1000) {
        vars.set(varName, iter)
        executeBlock([...bodyLines], vars, out)
        iter = incr === "++" ? iter + 1 : iter - 1
        count++
      }
      vars.set(varName, iter)
      continue
    }

    // If/else
    const ifMatch = line.match(/^if\s*\((.+)\)\s*\{?\s*$/)
    if (ifMatch) {
      const condition = evaluateCondition(ifMatch[1], vars)
      const ifBody: string[] = []
      const elseBody: string[] = []
      let braceCount = line.includes("{") ? 1 : 0
      i++
      if (braceCount === 0 && i < lines.length && lines[i] === "{") {
        braceCount = 1
        i++
      }
      while (i < lines.length && braceCount > 0) {
        if (lines[i].includes("{")) braceCount++
        if (lines[i].includes("}")) braceCount--
        if (braceCount > 0) ifBody.push(lines[i])
        i++
      }

      // Check for else
      if (i < lines.length && lines[i].match(/^}\s*else\s*\{?\s*$/)) {
        braceCount = lines[i].includes("{") ? 1 : 0
        i++
        if (braceCount === 0 && i < lines.length && lines[i] === "{") {
          braceCount = 1
          i++
        }
        while (i < lines.length && braceCount > 0) {
          if (lines[i].includes("{")) braceCount++
          if (lines[i].includes("}")) braceCount--
          if (braceCount > 0) elseBody.push(lines[i])
          i++
        }
      } else if (i < lines.length && lines[i].startsWith("else")) {
        braceCount = lines[i].includes("{") ? 1 : 0
        i++
        while (i < lines.length && braceCount > 0) {
          if (lines[i].includes("{")) braceCount++
          if (lines[i].includes("}")) braceCount--
          if (braceCount > 0) elseBody.push(lines[i])
          i++
        }
      }

      executeBlock(condition ? ifBody : elseBody, vars, out)
      continue
    }

    i++
  }
}

function evaluateExpr(expr: string, vars: Map<string, VarValue>): VarValue {
  expr = expr.trim()

  // String literal
  if (expr.startsWith('"') && expr.endsWith('"')) {
    return expr.slice(1, -1)
  }

  // String concatenation
  if (expr.includes("+") && expr.includes('"')) {
    const parts = splitConcatenation(expr)
    return parts
      .map((p) => {
        p = p.trim()
        if (p.startsWith('"') && p.endsWith('"')) return p.slice(1, -1)
        if (vars.has(p)) return formatValue(vars.get(p)!)
        const num = parseFloat(p)
        if (!isNaN(num)) return formatNumber(num)
        // Try evaluating as arithmetic
        const result = tryArithmetic(p, vars)
        if (result !== null) return formatNumber(result)
        return p
      })
      .join("")
  }

  // Variable reference
  if (vars.has(expr)) return vars.get(expr)!

  // Array access: arr[i]
  const arrAccess = expr.match(/^(\w+)\[(.+)\]$/)
  if (arrAccess) {
    const arr = vars.get(arrAccess[1])
    if (Array.isArray(arr)) {
      const idx = toNumber(evaluateExpr(arrAccess[2], vars))
      return arr[idx] ?? 0
    }
  }

  // Array length: arr.length
  const lenMatch = expr.match(/^(\w+)\.length$/)
  if (lenMatch) {
    const arr = vars.get(lenMatch[1])
    if (Array.isArray(arr)) return arr.length
  }

  // Arithmetic
  const arithResult = tryArithmetic(expr, vars)
  if (arithResult !== null) return arithResult

  // Number literal
  const num = parseFloat(expr)
  if (!isNaN(num)) return num

  // Boolean
  if (expr === "true") return 1
  if (expr === "false") return 0

  return `[Cannot simulate: ${expr}]`
}

function splitConcatenation(expr: string): string[] {
  const parts: string[] = []
  let current = ""
  let inString = false
  let depth = 0

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i]
    if (ch === '"') inString = !inString
    if (!inString && ch === "(") depth++
    if (!inString && ch === ")") depth--
    if (!inString && depth === 0 && ch === "+") {
      parts.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  if (current) parts.push(current)
  return parts
}

function tryArithmetic(expr: string, vars: Map<string, VarValue>): number | null {
  // Replace variable names with values
  let resolved = expr
  const varNames = [...vars.keys()].sort((a, b) => b.length - a.length)
  for (const name of varNames) {
    const val = vars.get(name)
    if (typeof val === "number") {
      resolved = resolved.replace(new RegExp(`\\b${name}\\b`, "g"), String(val))
    }
  }

  // Only allow safe characters
  if (!/^[\d\s+\-*/().]+$/.test(resolved)) return null

  try {
    const result = Function(`"use strict"; return (${resolved})`)()
    return typeof result === "number" && isFinite(result) ? result : null
  } catch {
    return null
  }
}

function evaluateCondition(expr: string, vars: Map<string, VarValue>): boolean {
  const operators = [">=", "<=", "!=", "==", ">", "<"]
  for (const op of operators) {
    const idx = expr.indexOf(op)
    if (idx !== -1) {
      const left = toNumber(evaluateExpr(expr.slice(0, idx), vars))
      const right = toNumber(evaluateExpr(expr.slice(idx + op.length), vars))
      if (op === ">=") return left >= right
      if (op === "<=") return left <= right
      if (op === ">") return left > right
      if (op === "<") return left < right
      if (op === "==") return left === right
      if (op === "!=") return left !== right
    }
  }
  return false
}

function toNumber(val: VarValue): number {
  if (typeof val === "number") return val
  if (typeof val === "string") return parseFloat(val) || 0
  return 0
}

function formatValue(val: VarValue): string {
  if (typeof val === "number") return formatNumber(val)
  if (Array.isArray(val)) return val.map(formatNumber).join(", ")
  return String(val)
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n)
  // Show decimal but trim trailing zeros, keep at least one decimal
  const s = n.toFixed(10).replace(/0+$/, "").replace(/\.$/, ".0")
  return s
}
