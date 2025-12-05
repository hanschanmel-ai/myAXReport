import json
import os

class Database:
    def __init__(self, db_file='app_data.json'):
        self.db_file = db_file
        self.load_data()
    
    def load_data(self):
        if os.path.exists(self.db_file):
            try:
                with open(self.db_file, 'r') as f:
                    self.data = json.load(f)
            except:
                self.initialize_data()
        else:
            self.initialize_data()
    
    def initialize_data(self):
        self.data = {
            'users': {
                'parent': {
                    'password': 'password',
                    'role': 'parent'
                }
            },
            'devices': {
                'Child\'s Phone': {
                    'owner': 'child',
                    'status': 'monitored'
                }
            },
            'settings': {
                'filtering_enabled': True,
                'monitoring_enabled': True,
                'notifications_enabled': True
            }
        }
        self.save_data()
    
    def save_data(self):
        with open(self.db_file, 'w') as f:
            json.dump(self.data, f)
    
    def get_user(self, username):
        return self.data['users'].get(username)
    
    def add_user(self, username, password, role):
        if username not in self.data['users']:
            self.data['users'][username] = {
                'password': password,
                'role': role
            }
            self.save_data()
            return True
        return False
    
    def get_devices(self):
        return self.data['devices']
    
    def add_device(self, device_name, owner, status='monitored'):
        if device_name not in self.data['devices']:
            self.data['devices'][device_name] = {
                'owner': owner,
                'status': status
            }
            self.save_data()
            return True
        return False
    
    def get_settings(self):
        return self.data['settings']
    
    def update_settings(self, settings):
        self.data['settings'].update(settings)
        self.save_data()