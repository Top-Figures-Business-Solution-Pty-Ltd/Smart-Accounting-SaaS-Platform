# Smart Accounting - Services Module
# 服务模块，提供缓存、格式化等通用服务

from .cache import (
    get_company_cache,
    get_company_abbreviation,
    clear_company_cache,
    get_user_cache,
    get_cached_user_info,
    clear_user_cache
)

from .formatters import (
    format_date_for_display,
    get_initials,
    format_currency,
    truncate_text,
    escape_html,
    format_datetime_for_display
)

__all__ = [
    # Cache
    'get_company_cache',
    'get_company_abbreviation',
    'clear_company_cache',
    'get_user_cache',
    'get_cached_user_info',
    'clear_user_cache',
    # Formatters
    'format_date_for_display',
    'get_initials',
    'format_currency',
    'truncate_text',
    'escape_html',
    'format_datetime_for_display'
]

