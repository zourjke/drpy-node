import os
import datetime
import argparse
import re

# 要排除的目录列表
EXCLUDE_DIRS = ['.git', '.idea', 'soft', 'examples', 'apps/cat', 'plugins/pvideo', 'plugins/req-proxy',
                'plugins/pup-sniffer', 'plugins/mediaProxy',
                'pyTools', 'drop_code',
                'local', 'logs',
                '对话1.txt',
                'vod_cache', 'data/mv', 'drpy-node-mcp', 'drpy-node-bundle', 'drpy-node-admin', 'drpy2-quickjs']

# 要排除的文件列表
EXCLUDE_FILES = ['config/env.json', '.env', '.claude', 'clipboard.txt', 'clipboard.txt.bak', '.plugins.js', 'yarn.lock',
                 't4_daemon.pid',
                 'spider/js/UC分享.js', 'spider/js/百忙无果[官].js',
                 'spider/catvod/mtv60w[差].js',
                 'json/UC分享.json',
                 'jx/_30wmv.js', 'jx/奇奇.js', 'jx/芒果关姐.js', 'data/settings/link_data.json', 'index.json',
                 'custom.json']


def get_script_dir():
    """
    获取当前脚本所在目录
    """
    return os.path.dirname(os.path.abspath(__file__))


def filter_green_files(script_dir):
    """
    筛选 js 目录下所有带 [密] 的文件
    """
    js_dir = os.path.join(script_dir, 'spider/js')
    green_files = []

    if os.path.exists(js_dir):
        for root, _, files in os.walk(js_dir):
            for file in files:
                if re.search(r'\[密[^\]]*\]', file):
                    green_files.append(os.path.relpath(os.path.join(root, file), script_dir))

    return green_files


def generate_archive_name(script_dir, green=False, use_zip=False):
    """
    生成压缩包文件名
    
    Args:
        script_dir (str): 脚本所在目录
        green (bool): 是否为green模式
        use_zip (bool): 是否使用ZIP格式
        
    Returns:
        str: 压缩包的完整路径
    """
    # 获取当前目录名
    current_dir = os.path.basename(script_dir)

    # 获取当前时间
    current_time = datetime.datetime.now().strftime("%Y%m%d")

    # 根据是否传入 green 参数生成压缩包文件名
    archive_suffix = "-green" if green else ""
    archive_ext = ".zip" if use_zip else ".7z"
    archive_name = f"{current_dir}-{current_time}{archive_suffix}{archive_ext}"

    # 压缩包输出路径 (脚本所在目录的外面)
    parent_dir = os.path.abspath(os.path.join(script_dir, ".."))
    archive_path = os.path.join(parent_dir, archive_name)

    return archive_path


def build_exclude_params(script_dir, green=False):
    """
    构建7z压缩命令的排除参数
    
    Args:
        script_dir (str): 脚本所在目录
        green (bool): 是否为green模式
        
    Returns:
        list: 排除参数列表
    """
    exclude_params = []

    # 排除目录
    for exclude_dir in EXCLUDE_DIRS:
        exclude_params.append(f"-xr!{exclude_dir}")

    # 排除文件
    for exclude_file in EXCLUDE_FILES:
        # 使用相对路径来确保文件的准确性
        exclude_file_path = os.path.join(script_dir, exclude_file)
        if os.path.exists(exclude_file_path):
            exclude_params.append(f"-xr!{exclude_file}")
        else:
            print(f"警告: {exclude_file} 不存在!")

    # 如果启用 green 筛选，排除不符合条件的文件
    if green:
        green_files = filter_green_files(script_dir)
        for file in green_files:
            exclude_params.append(f"-x!{file}")

    return exclude_params


def execute_compression(archive_path, script_dir, exclude_params, use_zip=False):
    """
    执行7z压缩命令
    
    Args:
        archive_path (str): 压缩包输出路径
        script_dir (str): 脚本所在目录
        exclude_params (list): 排除参数列表
        use_zip (bool): 是否使用ZIP格式
    """
    # 构建命令，打包目录内容而不包含目录本身
    archive_type = "zip" if use_zip else "7z"
    command = f"7z a -t{archive_type} \"{archive_path}\" \"{script_dir}\\*\" " + " ".join(exclude_params)

    # 打印构建的命令进行调试
    print(f"构建的 7z 命令: {command}")

    try:
        # 执行压缩命令
        os.system(command)
        print(f"压缩完成: {archive_path}")
    except Exception as e:
        print(f"压缩失败: {e}")


def compress_directory(script_dir, green=False, use_zip=False):
    """
    压缩目录为7z包
    
    Args:
        script_dir (str): 要压缩的目录路径
        green (bool): 是否启用green模式，筛选带[密]的文件
        use_zip (bool): 是否使用ZIP格式
    """
    # 生成压缩包文件名和路径
    archive_path = generate_archive_name(script_dir, green, use_zip)

    # 构建排除参数
    exclude_params = build_exclude_params(script_dir, green)

    # 执行压缩
    execute_compression(archive_path, script_dir, exclude_params, use_zip)


if __name__ == "__main__":
    # 获取脚本所在目录
    script_dir = get_script_dir()

    # 解析命令行参数
    parser = argparse.ArgumentParser(description="压缩当前目录为 7z 包，支持可选参数。")
    parser.add_argument('-g', '--green', action='store_true', help="启用 green 模式，筛选 js 目录下所有带 [密] 的文件。")
    parser.add_argument('-z', '--zip', action='store_true', help="使用 ZIP 格式打包，默认使用 7z 格式。")
    args = parser.parse_args()

    # 调用压缩函数
    compress_directory(script_dir, green=args.green, use_zip=args.zip)
