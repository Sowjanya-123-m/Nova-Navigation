import json
from flask import Blueprint, jsonify, redirect, render_template, request, url_for, flash
from flask_login import current_user, login_required, login_user, logout_user
from werkzeug.security import check_password_hash, generate_password_hash

from . import db
from .models import SavedRoute, Stop, User, Vehicle

main = Blueprint('main', __name__)


@main.route('/')
@login_required
def home():
    return render_template('index.html', username=current_user.username)


@main.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main.home'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            flash('Login successful', 'success')
            return redirect(url_for('main.home'))
        flash('Invalid credentials', 'danger')

    return render_template('login.html')


@main.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('main.home'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        if not username or not password:
            flash('Username and password are required', 'danger')
        elif User.query.filter_by(username=username).first():
            flash('Username already exists', 'danger')
        else:
            user = User(username=username, password_hash=generate_password_hash(password))
            db.session.add(user)
            db.session.commit()
            login_user(user)
            flash('Registration successful', 'success')
            return redirect(url_for('main.home'))

    return render_template('register.html')


@main.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('main.login'))


@main.route('/api/stops', methods=['GET', 'POST'])
@login_required
def stops_api():
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        stop = Stop(
            name=data.get('name', 'Stop'),
            lat=float(data.get('lat', 0)),
            lng=float(data.get('lng', 0)),
            priority=data.get('priority', 'Medium'),
            user_id=current_user.id,
        )
        db.session.add(stop)
        db.session.commit()
        return jsonify({'id': stop.id, 'name': stop.name, 'lat': stop.lat, 'lng': stop.lng, 'priority': stop.priority}), 201

    stops = Stop.query.filter_by(user_id=current_user.id).all()
    return jsonify([{'id': s.id, 'name': s.name, 'lat': s.lat, 'lng': s.lng, 'priority': s.priority} for s in stops])


@main.route('/api/stops/<int:stop_id>', methods=['PUT', 'DELETE'])
@login_required
def stop_detail(stop_id):
    stop = Stop.query.filter_by(id=stop_id, user_id=current_user.id).first_or_404()
    if request.method == 'PUT':
        data = request.get_json(silent=True) or {}
        stop.name = data.get('name', stop.name)
        stop.lat = float(data.get('lat', stop.lat))
        stop.lng = float(data.get('lng', stop.lng))
        stop.priority = data.get('priority', stop.priority)
        db.session.commit()
        return jsonify({'id': stop.id, 'name': stop.name, 'lat': stop.lat, 'lng': stop.lng, 'priority': stop.priority})

    db.session.delete(stop)
    db.session.commit()
    return jsonify({'deleted': True, 'id': stop_id})


@main.route('/api/vehicles', methods=['GET', 'POST'])
@login_required
def vehicles_api():
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        vehicle = Vehicle(
            name=data.get('name', 'Vehicle'),
            capacity=int(data.get('capacity', 1000)),
            vehicle_type=data.get('vehicle_type', 'Truck'),
            user_id=current_user.id,
        )
        db.session.add(vehicle)
        db.session.commit()
        return jsonify({'id': vehicle.id, 'name': vehicle.name, 'capacity': vehicle.capacity, 'vehicle_type': vehicle.vehicle_type}), 201

    vehicles = Vehicle.query.filter_by(user_id=current_user.id).all()
    return jsonify([{'id': v.id, 'name': v.name, 'capacity': v.capacity, 'vehicle_type': v.vehicle_type} for v in vehicles])


@main.route('/api/routes', methods=['GET', 'POST'])
@login_required
def routes_api():
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        route = SavedRoute(name=data.get('name', 'Route'), route_data=json.dumps(data.get('route_data', {})), user_id=current_user.id)
        db.session.add(route)
        db.session.commit()
        return jsonify({'id': route.id, 'name': route.name, 'route_data': json.loads(route.route_data)}), 201

    routes = SavedRoute.query.filter_by(user_id=current_user.id).all()
    return jsonify([{'id': route.id, 'name': route.name, 'route_data': json.loads(route.route_data)} for route in routes])
