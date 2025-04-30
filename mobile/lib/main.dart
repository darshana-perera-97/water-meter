import 'package:flutter/material.dart';
import 'splash_screen.dart';
import 'dashboard_page.dart';
import 'profile_page.dart';

void main() => runApp(const MyApp());

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Splash → Bottom Tabs Demo',
      theme: ThemeData(primarySwatch: Colors.blue),
      home: const SplashScreen(),
       debugShowCheckedModeBanner: false, // 👈 Add this line
      routes: {
        '/dashboard': (_) => const DashboardPage(),
        '/profile': (_) => const ProfilePage(),
      },
    );
  }
}
