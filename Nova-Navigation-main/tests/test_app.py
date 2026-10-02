import os
import tempfile
import pytest

from app import create_app, db


@pytest.fixture()
def client():
    app = create_app({'TESTING': True, 'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:'})
    app.config['SECRET_KEY'] = 'test-secret'
    with app.app_context():
        db.create_all()
        yield app.test_client()
        db.session.remove()
        db.drop_all()


def test_register_login_and_stop_crud(client):
    res = client.post('/register', data={'username': 'demo', 'password': 'secret123'}, follow_redirects=True)
    assert res.status_code == 200

    res = client.post('/login', data={'username': 'demo', 'password': 'secret123'}, follow_redirects=True)
    assert b'Welcome' in res.data

    res = client.post('/api/stops', json={'name': 'Warehouse', 'lat': 12.97, 'lng': 77.59})
    assert res.status_code == 201
    payload = res.get_json()
    assert payload['name'] == 'Warehouse'
