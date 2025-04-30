import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

class HomeTab extends StatefulWidget {
  const HomeTab({super.key});

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  final String apiBase = 'http://localhost:3020';

  bool? deviceStatus;
  Map<String, dynamic> deviceData = {
    'flowRateLpm': '–',
    'totalVolumeL': '–',
    'valve': null,
  };
  Map<String, dynamic>? todayUsage;
  double? monthlyCost;
  bool isToggling = false;

  Timer? _timer;

  @override
  void initState() {
    super.initState();
    fetchAllData();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => fetchAllData());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> fetchAllData() async {
    await Future.wait([
      fetchStatus(),
      fetchDeviceData(),
      fetchTodayUsage(),
      fetchMonthlyCost(),
    ]);
  }

  Future<void> fetchStatus() async {
    try {
      final res = await http.get(Uri.parse('$apiBase/deviceStatus'));
      if (res.statusCode == 200) {
        final json = jsonDecode(res.body);
        setState(() => deviceStatus = json['deviceStatus']);
      }
    } catch (_) {}
  }

  Future<void> fetchDeviceData() async {
    try {
      final res = await http.get(Uri.parse('$apiBase/deviceData'));
      final json = jsonDecode(res.body);
      if (res.statusCode == 200) {
        setState(() => deviceData = json);
      }
    } catch (_) {}
  }

  Future<void> fetchTodayUsage() async {
    try {
      final res = await http.get(Uri.parse('$apiBase/usage/today'));
      final json = jsonDecode(res.body);
      if (res.statusCode == 200) {
        setState(() => todayUsage = json);
      }
    } catch (_) {}
  }

  Future<void> fetchMonthlyCost() async {
    try {
      final res = await http.get(Uri.parse('$apiBase/cost'));
      final json = jsonDecode(res.body);
      if (res.statusCode == 200) {
        setState(() => monthlyCost = (json['value'] ?? 0).toDouble());
      }
    } catch (_) {}
  }

  Future<void> handleToggle() async {
    setState(() => isToggling = true);
    try {
      final res = await http.post(Uri.parse('$apiBase/toggleValve'));
      final json = jsonDecode(res.body);
      if (res.statusCode == 200) {
        setState(() => deviceData['valve'] = json['valve']);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Valve toggled: ${json['valve'] ? "OPEN" : "CLOSED"}'),
          backgroundColor: Colors.green,
        ));
      }
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text("Failed to toggle valve"),
            backgroundColor: Colors.red),
      );
    } finally {
      setState(() => isToggling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          const Text(
            '💧 Smart Water Meter Dashboard',
            style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 20),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 16,
            crossAxisSpacing: 16,
            childAspectRatio: 1.3,
            children: [
              buildStatusCard(),
              buildInfoCard(
                  'Flow Rate',
                  '${_safeFormat(deviceData['flowRateLpm'])} L/min',
                  Icons.speed),
              buildInfoCard('Total Volume', '${deviceData['totalVolumeL']} L',
                  Icons.water),
              buildValveCard(),
              buildUsageCard(),
              buildMonthlyCostCard(),
            ],
          ),
          const SizedBox(height: 30),
          ElevatedButton.icon(
            onPressed: isToggling ? null : handleToggle,
            icon: isToggling
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.autorenew),
            label: const Text('Toggle Valve'),
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
              textStyle: const TextStyle(fontSize: 18),
            ),
          ),
        ],
      ),
    );
  }

  Widget buildStatusCard() {
    return buildCard(
      title: 'Device Status',
      icon: Icons.power_settings_new,
      content: deviceStatus == null
          ? loadingSpinner()
          : Text(
              deviceStatus! ? 'ACTIVE' : 'INACTIVE',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: deviceStatus! ? Colors.green : Colors.red,
              ),
            ),
    );
  }

  Widget buildValveCard() {
    final valve = deviceData['valve'];
    String label = '–';
    Color color = Colors.grey;

    if (valve == true) {
      label = 'OPEN';
      color = Colors.green;
    } else if (valve == false) {
      label = 'CLOSED';
      color = Colors.red;
    }

    return buildCard(
      title: 'Valve',
      icon: Icons.settings_input_component,
      content: Text(
        label,
        style:
            TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color),
      ),
    );
  }

  Widget buildUsageCard() {
    return buildCard(
      title: "Today's Usage",
      icon: Icons.calendar_today,
      content: todayUsage == null
          ? loadingSpinner()
          : FittedBox(
              fit: BoxFit.scaleDown,
              child: Column(
                children: [
                  Text(
                    '${_safeFormat(todayUsage!['usage'], decimals: 3)} L',
                    style: const TextStyle(
                        fontSize: 22, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    todayUsage!['date'] ?? '',
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                ],
              ),
            ),
    );
  }

  Widget buildMonthlyCostCard() {
    return buildCard(
      title: 'Monthly Cost',
      icon: Icons.attach_money,
      content: monthlyCost == null
          ? loadingSpinner()
          : Text(
              'Rs. ${monthlyCost!.toStringAsFixed(2)}',
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: Colors.deepOrange,
              ),
            ),
    );
  }

  Widget buildInfoCard(String title, String value, IconData icon) {
    return buildCard(
      title: title,
      icon: icon,
      content: Text(
        value,
        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget buildCard({
    required String title,
    required IconData icon,
    required Widget content,
  }) {
    return Card(
      elevation: 3,
      shadowColor: Colors.grey[300],
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 28, color: Colors.blue),
            const SizedBox(height: 12),
            Text(
              title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            content,
          ],
        ),
      ),
    );
  }

  Widget loadingSpinner() {
    return const SizedBox(
      width: 24,
      height: 24,
      child: CircularProgressIndicator(strokeWidth: 2),
    );
  }

  String _safeFormat(dynamic value, {int decimals = 2}) {
    if (value == null || value == '–') return '–';
    try {
      return double.parse(value.toString()).toStringAsFixed(decimals);
    } catch (_) {
      return value.toString();
    }
  }
}
