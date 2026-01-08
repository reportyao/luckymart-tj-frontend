#!/usr/bin/env python3
import subprocess
import sys

functions = [
    'create-resale',
    'list-resale-items',
    'purchase-resale',
    'cancel-resale',
]

print("🚀 开始部署转售相关Edge Functions...")
print(f"共 {len(functions)} 个函数\n")

success_count = 0
failed_functions = []

for i, func_name in enumerate(functions, 1):
    print(f"[{i}/{len(functions)}] 部署 {func_name}...")
    
    cmd = [
        'manus-mcp-cli', 'tool', 'call', 'deploy_edge_function',
        '--server', 'supabase',
        '--input', f'{{"name": "{func_name}"}}'
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        
        if result.returncode == 0:
            print(f"  ✅ {func_name} 部署成功")
            success_count += 1
        else:
            print(f"  ❌ {func_name} 部署失败")
            print(f"     错误: {result.stderr}")
            failed_functions.append(func_name)
    except subprocess.TimeoutExpired:
        print(f"  ⏱️  {func_name} 部署超时")
        failed_functions.append(func_name)
    except Exception as e:
        print(f"  ❌ {func_name} 部署异常: {str(e)}")
        failed_functions.append(func_name)
    
    print()

print("\n" + "="*50)
print(f"部署完成！成功: {success_count}/{len(functions)}")

if failed_functions:
    print(f"\n失败的函数:")
    for func in failed_functions:
        print(f"  - {func}")
    sys.exit(1)
else:
    print("\n🎉 所有函数部署成功!")
    sys.exit(0)
