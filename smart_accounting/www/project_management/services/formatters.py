# Smart Accounting - Formatter Services
# 格式化服务模块，提供日期、文本等格式化功能

import re


def format_date_for_display(date_value):
    """
    Convert YYYY-MM-DD date format to DD-MM-YYYY for display
    """
    if not date_value:
        return ""
    
    try:
        # Handle both string and date objects
        if isinstance(date_value, str):
            if len(date_value) == 10 and date_value.count('-') == 2:
                parts = date_value.split('-')
                if len(parts[0]) == 4:  # YYYY-MM-DD format
                    return f"{parts[2]}-{parts[1]}-{parts[0]}"
            return date_value
        else:
            # Handle date objects
            return date_value.strftime('%d-%m-%Y')
    except:
        return str(date_value) if date_value else ""


def get_initials(name):
    """
    Generate initials from name or email
    """
    if not name:
        return "?"
    
    # Remove email domain if it's an email
    if '@' in name:
        name = name.split('@')[0]
    
    # Split by common separators and take first letter of each part
    parts = re.split(r'[.\s_-]+', name)
    initials = ''.join([part[0].upper() for part in parts if part])
    
    # Limit to 2 characters
    return initials[:2] if initials else "?"


def format_currency(value, currency_symbol='$'):
    """
    Format a numeric value as currency
    """
    if value is None:
        return f"{currency_symbol}0.00"
    
    try:
        return f"{currency_symbol}{float(value):,.2f}"
    except (ValueError, TypeError):
        return f"{currency_symbol}0.00"


def truncate_text(text, max_length=100, suffix='...'):
    """
    Truncate text to a maximum length with suffix
    """
    if not text:
        return ""
    
    if len(text) <= max_length:
        return text
    
    return text[:max_length - len(suffix)] + suffix


def escape_html(text):
    """
    Escape HTML special characters
    """
    if not text:
        return ""
    
    return (str(text)
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&#39;'))


def format_datetime_for_display(datetime_value):
    """
    Convert datetime to a readable format for display
    """
    if not datetime_value:
        return ""
    
    try:
        if hasattr(datetime_value, 'strftime'):
            return datetime_value.strftime('%d-%m-%Y %H:%M')
        return str(datetime_value)
    except:
        return str(datetime_value) if datetime_value else ""

