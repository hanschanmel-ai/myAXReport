import pypyodbc as pyodbc
import datetime

class DynamicsAXConnector:
    def __init__(self, server, database, username=None):
        # Use Windows Authentication
        self.connection_string = f'DRIVER={{SQL Server}};SERVER={server};DATABASE={database};Trusted_Connection=yes;'
        self.connection = None
        self.username = username
        
    def connect(self):
        try:
            self.connection = pyodbc.connect(self.connection_string)
            return True
        except Exception as e:
            print(f"Connection error: {str(e)}")
            return False
            
    def disconnect(self):
        if self.connection:
            self.connection.close()
            
    def get_user_access_level(self, user_id):
        """Get the user's access level from Dynamics AX"""
        if not self.connection:
            self.connect()
            
        cursor = self.connection.cursor()
        query = """
        SELECT DISTINCT
            SysUserInfo.ID AS UserID,
            SysSecurityUserRole.AOTName AS Role,
            SysSecurityRole.Name AS RoleName
        FROM SysUserInfo
        JOIN SysSecurityUserRole ON SysUserInfo.ID = SysSecurityUserRole.User_
        JOIN SysSecurityRole ON SysSecurityUserRole.SecurityRole = SysSecurityRole.RecId
        WHERE SysUserInfo.ID = ?
        """
        cursor.execute(query, (user_id,))
        roles = cursor.fetchall()
        cursor.close()
        
        # Check if user has AR module access
        has_ar_access = any('AccountsReceivable' in role[1] for role in roles)
        
        return {
            'user_id': user_id,
            'roles': [{'role_id': role[1], 'role_name': role[2]} for role in roles],
            'has_ar_access': has_ar_access
        }
    
    def get_ar_report_data(self, criteria):
        """Get Accounts Receivable data based on criteria"""
        if not self.connection:
            self.connect()
            
        cursor = self.connection.cursor()
        
        # Base query for AR data
        query = """
        SELECT 
            CustTable.AccountNum,
            CustTable.Name,
            CustTrans.TransDate,
            CustTrans.AmountMST,
            CustTrans.DueDate,
            CustTrans.Invoice,
            CustTrans.TransType
        FROM CustTrans
        JOIN CustTable ON CustTrans.AccountNum = CustTable.AccountNum
        WHERE 1=1
        """
        
        params = []
        
        # Add filters based on criteria
        if 'customer_id' in criteria and criteria['customer_id']:
            query += " AND CustTable.AccountNum = ?"
            params.append(criteria['customer_id'])
            
        if 'from_date' in criteria and criteria['from_date']:
            query += " AND CustTrans.TransDate >= ?"
            params.append(criteria['from_date'])
            
        if 'to_date' in criteria and criteria['to_date']:
            query += " AND CustTrans.TransDate <= ?"
            params.append(criteria['to_date'])
            
        if 'invoice_id' in criteria and criteria['invoice_id']:
            query += " AND CustTrans.Invoice = ?"
            params.append(criteria['invoice_id'])
        
        cursor.execute(query, params)
        results = cursor.fetchall()
        cursor.close()
        
        # Format results
        ar_data = []
        for row in results:
            ar_data.append({
                'customer_id': row[0],
                'customer_name': row[1],
                'transaction_date': row[2],
                'amount': row[3],
                'due_date': row[4],
                'invoice': row[5],
                'transaction_type': row[6]
            })
            
        return ar_data