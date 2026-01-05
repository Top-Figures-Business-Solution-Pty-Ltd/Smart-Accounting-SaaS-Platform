/**
 * Smart Board - API Service
 * Frappe API调用封装
 */

export class ApiService {
    /**
     * 通用GET请求
     */
    static async get(endpoint, params = {}) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const url = queryString ? `${endpoint}?${queryString}` : endpoint;
            
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: params
            });
            
            return response.message || [];
        } catch (error) {
            console.error('API GET Error:', error);
            throw error;
        }
    }
    
    /**
     * 通用POST请求
     */
    static async post(endpoint, data = {}) {
        try {
            const response = await frappe.call({
                method: endpoint,
                args: data
            });
            
            return response.message;
        } catch (error) {
            console.error('API POST Error:', error);
            throw error;
        }
    }
    
    /**
     * 获取单个文档
     */
    static async getDoc(doctype, name) {
        try {
            const response = await frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: doctype,
                    name: name
                }
            });
            
            return response.message;
        } catch (error) {
            console.error('API getDoc Error:', error);
            throw error;
        }
    }
    
    /**
     * 更新文档
     */
    static async updateDoc(doctype, name, data) {
        try {
            const response = await frappe.call({
                method: 'frappe.client.set_value',
                args: {
                    doctype: doctype,
                    name: name,
                    fieldname: data
                }
            });
            
            return response.message;
        } catch (error) {
            console.error('API updateDoc Error:', error);
            throw error;
        }
    }
    
    /**
     * 删除文档
     */
    static async deleteDoc(doctype, name) {
        try {
            await frappe.call({
                method: 'frappe.client.delete',
                args: {
                    doctype: doctype,
                    name: name
                }
            });
            
            return true;
        } catch (error) {
            console.error('API deleteDoc Error:', error);
            throw error;
        }
    }
}

