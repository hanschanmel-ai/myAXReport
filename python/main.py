from kivy.app import App
from kivy.uix.screenmanager import ScreenManager, Screen
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.textinput import TextInput
from kivy.uix.togglebutton import ToggleButton
from kivy.uix.scrollview import ScrollView
from kivy.uix.gridlayout import GridLayout
from kivy.core.window import Window
from kivy.clock import Clock

# Import our custom modules
from website_filter import WebsiteFilter
from monitoring import ActivityMonitor
from database import Database

class LoginScreen(Screen):
    def __init__(self, **kwargs):
        super(LoginScreen, self).__init__(**kwargs)
        layout = BoxLayout(orientation='vertical', padding=20, spacing=10)
        
        title = Label(text='SafeNet Parental Control', font_size=24, size_hint_y=None, height=50)
        
        username_layout = BoxLayout(orientation='horizontal', size_hint_y=None, height=40)
        username_label = Label(text='Username:', size_hint_x=0.3)
        self.username_input = TextInput(hint_text='Enter username', multiline=False, size_hint_x=0.7)
        username_layout.add_widget(username_label)
        username_layout.add_widget(self.username_input)
        
        password_layout = BoxLayout(orientation='horizontal', size_hint_y=None, height=40)
        password_label = Label(text='Password:', size_hint_x=0.3)
        self.password_input = TextInput(hint_text='Enter password', password=True, multiline=False, size_hint_x=0.7)
        password_layout.add_widget(password_label)
        password_layout.add_widget(self.password_input)
        
        login_button = Button(text='Login', size_hint_y=None, height=50)
        login_button.bind(on_press=self.login)
        
        register_button = Button(text='Register', size_hint_y=None, height=50)
        register_button.bind(on_press=self.register)
        
        layout.add_widget(title)
        layout.add_widget(username_layout)
        layout.add_widget(password_layout)
        layout.add_widget(login_button)
        layout.add_widget(register_button)
        
        self.add_widget(layout)
    
    def login(self, instance):
        username = self.username_input.text
        password = self.password_input.text
        
        # In a real app, you would validate credentials against a database
        if username == 'parent' and password == 'password':
            self.manager.current = 'dashboard'
        else:
            # Show error message
            pass
    
    def register(self, instance):
        # In a real app, you would implement registration logic
        pass

class DashboardScreen(Screen):
    def __init__(self, **kwargs):
        super(DashboardScreen, self).__init__(**kwargs)
        layout = BoxLayout(orientation='vertical', padding=20, spacing=10)
        
        title = Label(text='Dashboard', font_size=24, size_hint_y=None, height=50)
        
        buttons_layout = GridLayout(cols=2, spacing=10, size_hint_y=None, height=200)
        
        block_sites_button = Button(text='Block Websites')
        block_sites_button.bind(on_press=self.go_to_block_sites)
        
        whitelist_button = Button(text='Whitelist Sites')
        whitelist_button.bind(on_press=self.go_to_whitelist)
        
        monitor_button = Button(text='Monitor Activity')
        monitor_button.bind(on_press=self.go_to_monitor)
        
        settings_button = Button(text='Settings')
        settings_button.bind(on_press=self.go_to_settings)
        
        buttons_layout.add_widget(block_sites_button)
        buttons_layout.add_widget(whitelist_button)
        buttons_layout.add_widget(monitor_button)
        buttons_layout.add_widget(settings_button)
        
        logout_button = Button(text='Logout', size_hint_y=None, height=50)
        logout_button.bind(on_press=self.logout)
        
        layout.add_widget(title)
        layout.add_widget(buttons_layout)
        layout.add_widget(Label(text='', size_hint_y=1))  # Spacer
        layout.add_widget(logout_button)
        
        self.add_widget(layout)
    
    def go_to_block_sites(self, instance):
        self.manager.current = 'block_sites'
    
    def go_to_whitelist(self, instance):
        self.manager.current = 'whitelist'
    
    def go_to_monitor(self, instance):
        self.manager.current = 'monitor'
    
    def go_to_settings(self, instance):
        self.manager.current = 'settings'
    
    def logout(self, instance):
        self.manager.current = 'login'

class BlockSitesScreen(Screen):
    def __init__(self, **kwargs):
        super(BlockSitesScreen, self).__init__(**kwargs)
        self.website_filter = WebsiteFilter()
        
        layout = BoxLayout(orientation='vertical', padding=20, spacing=10)
        
        title = Label(text='Block Harmful Websites', font_size=24, size_hint_y=None, height=50)
        
        # Category toggles
        categories_layout = GridLayout(cols=2, spacing=10, size_hint_y=None, height=200)
        
        categories = [
            'Adult Content', 'Violence', 'Gambling', 'Social Media', 
            'Games', 'Streaming', 'Forums', 'Dating'
        ]
        
        self.category_toggles = {}
        for category in categories:
            toggle = ToggleButton(text=category)
            toggle.bind(on_press=self.toggle_category)
            categories_layout.add_widget(toggle)
            self.category_toggles[category] = toggle
        
        # Custom site blocking
        custom_layout = BoxLayout(orientation='horizontal', size_hint_y=None, height=40)
        self.custom_site_input = TextInput(hint_text='Enter website to block (e.g., example.com)', multiline=False, size_hint_x=0.7)
        add_button = Button(text='Add', size_hint_x=0.3)
        add_button.bind(on_press=self.add_custom_site)
        custom_layout.add_widget(self.custom_site_input)
        custom_layout.add_widget(add_button)
        
        # Blocked sites list
        scroll_layout = BoxLayout(orientation='vertical', size_hint_y=1)
        scroll_view = ScrollView(size_hint=(1, 1))
        self.blocked_sites_layout = GridLayout(cols=1, spacing=5, size_hint_y=None)
        self.blocked_sites_layout.bind(minimum_height=self.blocked_sites_layout.setter('height'))
        scroll_view.add_widget(self.blocked_sites_layout)
        scroll_layout.add_widget(scroll_view)
        
        # Back button
        back_button = Button(text='Back to Dashboard', size_hint_y=None, height=50)
        back_button.bind(on_press=self.go_back)
        
        layout.add_widget(title)
        layout.add_widget(categories_layout)
        layout.add_widget(custom_layout)
        layout.add_widget(scroll_layout)
        layout.add_widget(back_button)
        
        self.add_widget(layout)
        
        # Load blocked sites
        self.update_blocked_sites_list()
    
    def toggle_category(self, instance):
        category = instance.text
        is_blocked = instance.state == 'down'
        if is_blocked:
            self.website_filter.block_category(category)
        else:
            self.website_filter.unblock_category(category)
        self.update_blocked_sites_list()
    
    def add_custom_site(self, instance):
        site = self.custom_site_input.text.strip()
        if site:
            self.website_filter.block_site(site)
            self.custom_site_input.text = ''
            self.update_blocked_sites_list()
    
    def update_blocked_sites_list(self):
        self.blocked_sites_layout.clear_widgets()
        blocked_sites = self.website_filter.get_blocked_sites()
        
        for site in blocked_sites:
            site_layout = BoxLayout(orientation='horizontal', size_hint_y=None, height=40)
            site_label = Label(text=site, size_hint_x=0.8)
            remove_button = Button(text='Remove', size_hint_x=0.2)
            remove_button.site = site  # Store site reference
            remove_button.bind(on_press=self.remove_site)
            
            site_layout.add_widget(site_label)
            site_layout.add_widget(remove_button)
            self.blocked_sites_layout.add_widget(site_layout)
    
    def remove_site(self, instance):
        site = instance.site
        self.website_filter.unblock_site(site)
        self.update_blocked_sites_list()
    
    def go_back(self, instance):
        self.manager.current = 'dashboard'

class WhitelistScreen(Screen):
    def __init__(self, **kwargs):
        super(WhitelistScreen, self).__init__(**kwargs)
        self.website_filter = WebsiteFilter()
        
        layout = BoxLayout(orientation='vertical', padding=20, spacing=10)
        
        title = Label(text='Whitelist Websites', font_size=24, size_hint_y=None, height=50)
        
        # Add site to whitelist
        whitelist_layout = BoxLayout(orientation='horizontal', size_hint_y=None, height=40)
        self.whitelist_input = TextInput(hint_text='Enter website to whitelist (e.g., school.edu)', multiline=False, size_hint_x=0.7)
        add_button = Button(text='Add', size_hint_x=0.3)
        add_button.bind(on_press=self.add_to_whitelist)
        whitelist_layout.add_widget(self.whitelist_input)
        whitelist_layout.add_widget(add_button)
        
        # Whitelisted sites list
        scroll_layout = BoxLayout(orientation='vertical', size_hint_y=1)
        scroll_view = ScrollView(size_hint=(1, 1))
        self.whitelist_sites_layout = GridLayout(cols=1, spacing=5, size_hint_y=None)
        self.whitelist_sites_layout.bind(minimum_height=self.whitelist_sites_layout.setter('height'))
        scroll_view.add_widget(self.whitelist_sites_layout)
        scroll_layout.add_widget(scroll_view)
        
        # Back button
        back_button = Button(text='Back to Dashboard', size_hint_y=None, height=50)
        back_button.bind(on_press=self.go_back)
        
        layout.add_widget(title)
        layout.add_widget(whitelist_layout)
        layout.add_widget(scroll_layout)
        layout.add_widget(back_button)
        
        self.add_widget(layout)
        
        # Load whitelisted sites
        self.update_whitelist()
    
    def add_to_whitelist(self, instance):
        site = self.whitelist_input.text.strip()
        if site:
            self.website_filter.whitelist_site(site)
            self.whitelist_input.text = ''
            self.update_whitelist()
    
    def update_whitelist(self):
        self.whitelist_sites_layout.clear_widgets()
        whitelisted_sites = self.website_filter.get_whitelisted_sites()
        
        for site in whitelisted_sites:
            site_layout = BoxLayout(orientation='horizontal', size_hint_y=None, height=40)
            site_label = Label(text=site, size_hint_x=0.8)
            remove_button = Button(text='Remove', size_hint_x=0.2)
            remove_button.site = site  # Store site reference
            remove_button.bind(on_press=self.remove_from_whitelist)
            
            site_layout.add_widget(site_label)
            site_layout.add_widget(remove_button)
            self.whitelist_sites_layout.add_widget(site_layout)
    
    def remove_from_whitelist(self, instance):
        site = instance.site
        self.website_filter.remove_from_whitelist(site)
        self.update_whitelist()
    
    def go_back(self, instance):
        self.manager.current = 'dashboard'

class MonitorScreen(Screen):
    def __init__(self, **kwargs):
        super(MonitorScreen, self).__init__(**kwargs)
        self.activity_monitor = ActivityMonitor()
        
        layout = BoxLayout(orientation='vertical', padding=20, spacing=10)
        
        title = Label(text='Monitor Activity', font_size=24, size_hint_y=None, height=50)
        
        # Device selection
        devices_layout = BoxLayout(orientation='horizontal', size_hint_y=None, height=40)
        devices_label = Label(text='Select Device:', size_hint_x=0.3)
        self.devices_input = TextInput(text='Child\'s Phone', multiline=False, size_hint_x=0.7)
        devices_layout.add_widget(devices_label)
        devices_layout.add_widget(self.devices_input)
        
        # Activity log
        log_label = Label(text='Activity Log:', size_hint_y=None, height=30, halign='left')
        log_label.bind(size=log_label.setter('text_size'))
        
        scroll_layout = BoxLayout(orientation='vertical', size_hint_y=1)
        scroll_view = ScrollView(size_hint=(1, 1))
        self.activity_layout = GridLayout(cols=1, spacing=5, size_hint_y=None)
        self.activity_layout.bind(minimum_height=self.activity_layout.setter('height'))
        scroll_view.add_widget(self.activity_layout)
        scroll_layout.add_widget(scroll_view)
        
        # Refresh and back buttons
        buttons_layout = BoxLayout(orientation='horizontal', size_hint_y=None, height=50, spacing=10)
        
        refresh_button = Button(text='Refresh')
        refresh_button.bind(on_press=self.refresh_activity)
        
        back_button = Button(text='Back to Dashboard')
        back_button.bind(on_press=self.go_back)
        
        buttons_layout.add_widget(refresh_button)
        buttons_layout.add_widget(back_button)
        
        layout.add_widget(title)
        layout.add_widget(devices_layout)
        layout.add_widget(log_label)
        layout.add_widget(scroll_layout)
        layout.add_widget(buttons_layout)
        
        self.add_widget(layout)
        
        # Start monitoring
        self.refresh_activity(None)
        Clock.schedule_interval(self.refresh_activity, 10)  # Refresh every 10 seconds
    
    def refresh_activity(self, instance):
        self.activity_layout.clear_widgets()
        activities = self.activity_monitor.get_recent_activity()
        
        for activity in activities:
            activity_layout = BoxLayout(orientation='vertical', size_hint_y=None, height=60, padding=(5, 5))
            
            info_layout = BoxLayout(orientation='horizontal', size_hint_y=None, height=30)
            time_label = Label(text=activity['time'], size_hint_x=0.3)
            site_label = Label(text=activity['site'], size_hint_x=0.7)
            info_layout.add_widget(time_label)
            info_layout.add_widget(site_label)
            
            status_layout = BoxLayout(orientation='horizontal', size_hint_y=None, height=30)
            status_label = Label(text=f"Status: {activity['status']}", size_hint_x=0.7)
            action_button = Button(text='Block', size_hint_x=0.3)
            if activity['status'] == 'Blocked':
                action_button.text = 'Unblock'
            action_button.site = activity['site']
            action_button.bind(on_press=self.toggle_block_status)
            status_layout.add_widget(status_label)
            status_layout.add_widget(action_button)
            
            activity_layout.add_widget(info_layout)
            activity_layout.add_widget(status_layout)
            self.activity_layout.add_widget(activity_layout)
    
    def toggle_block_status(self, instance):
        site = instance.site
        website_filter = WebsiteFilter()
        
        if instance.text == 'Block':
            website_filter.block_site(site)
            instance.text = 'Unblock'
        else:
            website_filter.unblock_site(site)
            instance.text = 'Block'
        
        self.refresh_activity(None)
    
    def go_back(self, instance):
        self.manager.current = 'dashboard'

class SettingsScreen(Screen):
    def __init__(self, **kwargs):
        super(SettingsScreen, self).__init__(**kwargs)
        
        layout = BoxLayout(orientation='vertical', padding=20, spacing=10)
        
        title = Label(text='Settings', font_size=24, size_hint_y=None, height=50)
        
        # Settings options
        settings_layout = GridLayout(cols=2, spacing=10, size_hint_y=None, height=200)
        
        # Enable/disable filtering
        filtering_label = Label(text='Website Filtering:')
        self.filtering_toggle = ToggleButton(text='Enabled', state='down')
        self.filtering_toggle.bind(on_press=self.toggle_filtering)
        
        # Enable/disable monitoring
        monitoring_label = Label(text='Activity Monitoring:')
        self.monitoring_toggle = ToggleButton(text='Enabled', state='down')
        self.monitoring_toggle.bind(on_press=self.toggle_monitoring)
        
        # Notification settings
        notification_label = Label(text='Notifications:')
        self.notification_toggle = ToggleButton(text='Enabled', state='down')
        self.notification_toggle.bind(on_press=self.toggle_notifications)
        
        # Add to settings layout
        settings_layout.add_widget(filtering_label)
        settings_layout.add_widget(self.filtering_toggle)
        settings_layout.add_widget(monitoring_label)
        settings_layout.add_widget(self.monitoring_toggle)
        settings_layout.add_widget(notification_label)
        settings_layout.add_widget(self.notification_toggle)
        
        # Save and back buttons
        buttons_layout = BoxLayout(orientation='horizontal', size_hint_y=None, height=50, spacing=10)
        
        save_button = Button(text='Save Settings')
        save_button.bind(on_press=self.save_settings)
        
        back_button = Button(text='Back to Dashboard')
        back_button.bind(on_press=self.go_back)
        
        buttons_layout.add_widget(save_button)
        buttons_layout.add_widget(back_button)
        
        layout.add_widget(title)
        layout.add_widget(settings_layout)
        layout.add_widget(Label(text='', size_hint_y=1))  # Spacer
        layout.add_widget(buttons_layout)
        
        self.add_widget(layout)
    
    def toggle_filtering(self, instance):
        # In a real app, this would update the filtering settings
        pass
    
    def toggle_monitoring(self, instance):
        # In a real app, this would update the monitoring settings
        pass
    
    def toggle_notifications(self, instance):
        # In a real app, this would update the notification settings
        pass
    
    def save_settings(self, instance):
        # In a real app, this would save all settings to a database
        pass
    
    def go_back(self, instance):
        self.manager.current = 'dashboard'

class ParentalControlApp(App):
    def build(self):
        # Set window size for testing on desktop
        Window.size = (400, 600)
        
        # Create screen manager
        sm = ScreenManager()
        
        # Add screens
        sm.add_widget(LoginScreen(name='login'))
        sm.add_widget(DashboardScreen(name='dashboard'))
        sm.add_widget(BlockSitesScreen(name='block_sites'))
        sm.add_widget(WhitelistScreen(name='whitelist'))
        sm.add_widget(MonitorScreen(name='monitor'))
        sm.add_widget(SettingsScreen(name='settings'))
        
        return sm

if __name__ == '__main__':
    ParentalControlApp().run()