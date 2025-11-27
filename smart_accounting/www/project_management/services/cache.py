# Smart Accounting - Cache Services
# 缓存服务模块，提供Company等数据的缓存功能

import frappe
import time

# 🚀 PERFORMANCE: Global Company cache (TF/TG only have 2 companies)
_company_cache = None
_company_cache_timestamp = None


def get_company_cache():
    """
    Get cached company data. Only loads once per request.
    TF/TG companies rarely change, so caching is very effective.
    """
    global _company_cache, _company_cache_timestamp
    
    # Cache for 5 minutes (300 seconds)
    current_time = time.time()
    
    if _company_cache is None or _company_cache_timestamp is None or (current_time - _company_cache_timestamp) > 300:
        companies = frappe.get_all("Company", fields=["name", "company_name", "abbr"])
        _company_cache = {c.name: c for c in companies}
        _company_cache_timestamp = current_time
    
    return _company_cache


def get_company_abbreviation(company_id):
    """
    Get company abbreviation from cache.
    Returns 'TF' for Top Figures, 'TG' for Top Grants, or first 2 letters for others.
    """
    if not company_id:
        return 'TF'  # Default
    
    cache = get_company_cache()
    company = cache.get(company_id)
    
    if company:
        company_name = company.company_name or company.name
        if 'Top Figures' in company_name:
            return 'TF'
        elif 'Top Grants' in company_name:
            return 'TG'
        else:
            return company.abbr or company_name[:2].upper()
    
    return 'TF'  # Default fallback


def clear_company_cache():
    """
    Clear the company cache. Call this when company data is updated.
    """
    global _company_cache, _company_cache_timestamp
    _company_cache = None
    _company_cache_timestamp = None


# User cache for avatar display
_user_cache = None
_user_cache_timestamp = None


def get_user_cache():
    """
    Get cached user data for avatar display.
    """
    global _user_cache, _user_cache_timestamp
    
    # Cache for 5 minutes (300 seconds)
    current_time = time.time()
    
    if _user_cache is None or _user_cache_timestamp is None or (current_time - _user_cache_timestamp) > 300:
        users = frappe.get_all("User", 
            fields=["name", "full_name", "email", "user_image"],
            filters={"enabled": 1}
        )
        _user_cache = {u.name: u for u in users}
        _user_cache_timestamp = current_time
    
    return _user_cache


def get_cached_user_info(user_email):
    """
    Get user info from cache for avatar display.
    """
    if not user_email:
        return None
    
    cache = get_user_cache()
    user = cache.get(user_email)
    
    if user:
        from .formatters import get_initials
        return {
            'email': user.name,
            'full_name': user.full_name or user.name,
            'initials': get_initials(user.full_name or user.name),
            'image': user.user_image
        }
    
    return None


def clear_user_cache():
    """
    Clear the user cache. Call this when user data is updated.
    """
    global _user_cache, _user_cache_timestamp
    _user_cache = None
    _user_cache_timestamp = None

